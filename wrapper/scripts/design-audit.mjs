import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import postcss from 'postcss';
import ts from 'typescript';
import {renderDesignCSS} from '../ui/design-system.mjs';

const sourceExtensions=new Set(['.css','.jsx','.tsx','.ts','.js','.mjs','.html','.svg']);
const styleProps=/^(?:color|background(?:-.+)?|fill|stroke|.*-color|font(?:-.+)?|line-height|letter-spacing|(?:margin|padding)(?:-.+)?|(?:row-|column-)?gap|border(?:-.+)?-radius|border-radius|box-shadow|text-shadow)$/;
const colorProps=/^(?:color|background(?:-color|-image)?|fill|stroke|.*-color|(?:box|text)-shadow)$/;
const typographyProps=/^(?:font|font-size|font-family|font-weight|line-height|letter-spacing)$/;
const spacingProps=/^(?:(?:margin|padding)(?:-.+)?|(?:row-|column-)?gap)$/;
const radiusProps=/radius$/;
const unstyled=/^(?:inherit|initial|unset|revert|revert-layer|normal|auto|none|transparent|currentColor|0|0px|0rem|50%|100%)$/i;
const trustedComponent={Modal:'modal.jsx',SettingRow:'settings-row.jsx',SettingsRow:'settings-row.jsx',PageHeading:'page-heading.tsx',SettingsNavigationRow:'settings-patterns.jsx'};
function withoutVars(value){let s=value,previous;do{previous=s;s=s.replace(/var\(--[\w-]+(?:\s*,\s*[^()]*)?\)/g,'TOKEN');}while(previous!==s);return s;}
export function styleViolation(property,value) {
 const prop=property.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
 const v=withoutVars(String(value).trim());
 if(unstyled.test(v))return null;
 if(/var\([^,]+,\s*(?:#[\da-f]{3,8}\b|(?:rgb|hsl|oklch)\()/i.test(String(value)))return 'color';
 if(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|oklch|oklab|lab|lch|color)\(/i.test(v))return 'color';
 if(/^(?:border(?:-(?:top|left|right|bottom))?|outline)$/.test(prop)&&v.split(/\s+/).some(word=>/^[a-z]+$/i.test(word)&&! /^(?:TOKEN|transparent|none|solid|dashed|dotted|double|hidden|groove|ridge|inset|outset|thin|medium|thick|currentColor|GrayText|ButtonText|CanvasText|Highlight)$/i.test(word)))return 'color';
 if(!styleProps.test(prop))return null;
 if(colorProps.test(prop)&&!/^url\(/i.test(v)){const words=v.replace(/-?(?:\d*\.)?\d+(?:px|rem|em|deg|turn|%)?/g,'').match(/[a-z][a-z-]*/gi)||[];const safe=/^(TOKEN|transparent|currentColor|none|inherit|initial|unset|auto|linear-gradient|radial-gradient|conic-gradient|repeating-linear-gradient|repeating-radial-gradient|color-mix|in|srgb|oklab|to|top|bottom|left|right|at|center|circle|ellipse|closest-side|farthest-side|closest-corner|farthest-corner|calc|inset|Canvas|CanvasText|ButtonText|Highlight|HighlightText)$/i;if(words.some(w=>!safe.test(w)))return 'color';}
 if(colorProps.test(prop)&&!v.includes('TOKEN')&&!/^(?:url\(|(?:Canvas|CanvasText|ButtonText|Highlight|HighlightText)$)/i.test(v))return 'color';
 if(typographyProps.test(prop)&&(!v.includes('TOKEN')||/\d/.test(v)))return 'typography';
 if((spacingProps.test(prop)||radiusProps.test(prop))&& /(?:^|[^\w-])-?(?:\d*\.)?\d+(?:px|rem|em)\b/.test(v))return spacingProps.test(prop)?'spacing':'radius';
 return null;
}
export function auditSource(file,source,definitions=new Set()) {
 const issues=[]; const add=(rule,line,detail)=>issues.push({file,line,rule,detail});
 if(file.endsWith('.css')) {
  let tree;try{tree=postcss.parse(source,{from:file});}catch(e){add('syntax',e.line||1,e.reason);return issues;}
  tree.walkAtRules(a=>{if((a.name==='import'&&/https?:|tailwindcss["';\s]*$|preflight/.test(a.params))||(a.name==='tailwind'&&a.params==='base'))add('external-reset',a.source.start.line,'External styles/preflight need integration into the shared stylesheet');});
  tree.walkAtRules('font-face',a=>{if(file!=='ui/styles.css')add('shared-font',a.source.start.line,'Fonts are registered centrally in styles.css');});
  tree.walkDecls(d=>{
   const selector=d.parent.selector || '@'+d.parent.name;
   const rule=styleViolation(d.prop,d.value);if(rule && d.parent.name!=='font-face')add(rule,d.source.start.line,`${selector} | ${d.prop}: ${d.value}`);
   for(const [,token]of d.value.matchAll(/var\((--[\w-]+)/g))if(!definitions.has(token))add('unknown-token',d.source.start.line,`${selector} | ${token}`);
   if(d.prop==='outline'&&/^(?:none|0)$/.test(d.value)&&/focus/.test(selector)&&!/:not\(\s*:focus-visible\s*\)/.test(selector))add('focus',d.source.start.line,`${selector} removes focus`);
  });
  return issues;
 }
 if(/\.(jsx|tsx|ts|mjs|js)$/.test(file)){
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,/\.(tsx|jsx)$/.test(file)?ts.ScriptKind.TSX:ts.ScriptKind.JS);
  for(const d of ast.parseDiagnostics)add('syntax',ast.getLineAndCharacterOfPosition(d.start).line+1,ts.flattenDiagnosticMessageText(d.messageText,' '));
  const line=n=>ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1;
  const literal=n=>n&&(ts.isStringLiteral(n)||ts.isNumericLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
  function visit(n){
   if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isTemplateExpression(n)) && /[{}][^{}]*(?:font-size|padding|margin|border-radius|background|color)\s*:/.test(n.getText(ast)))add('embedded-style',line(n),'Embedded stylesheet must use the audited CSS files');
   if(ts.isPropertyAssignment(n)&&ts.isObjectLiteralExpression(n.parent)&&!ts.isJsxExpression(n.parent.parent)){const key=n.name.getText(ast).replace(/["']/g,''),value=literal(n.initializer);if(value!==null){const rule=styleViolation(key,ts.isNumericLiteral(n.initializer)&&!['fontWeight','lineHeight'].includes(key)?value+'px':value);if(rule)add(rule,line(n),'object style '+key+': '+value);}}
   if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))for(const[,token]of n.text.matchAll(/var\((--[\w-]+)/g))if(!definitions.has(token))add('unknown-token',line(n),token);
   if((ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)) && /(?:^|[\s:])#[\da-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/i.test(n.text))add('literal-color',line(n),'Color literal: '+n.text.slice(0,160));
   if(ts.isFunctionDeclaration(n)&&n.name&&trustedComponent[n.name.text]&&path.basename(file)!==trustedComponent[n.name.text])add('shared-component',line(n),`Use shared ${n.name.text}`);
   if(ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n)){
    const tag=n.tagName.getText(ast), attrs=new Map(n.attributes.properties.filter(ts.isJsxAttribute).map(a=>[a.name.getText(ast),a]));
    const attr=k=>{const a=attrs.get(k)?.initializer;return ts.isJsxExpression(a||{})?literal(a.expression):literal(a);};
    const role=attr('role');
    if(attrs.has('onClick')&&/^(?:div|span|img|li|section)$/.test(tag)&&!(attrs.has('onKeyDown')&&attrs.has('tabIndex')&&role))add('keyboard',line(n),`${tag} onClick requires semantic control or role, tabIndex and onKeyDown`);
    if(role==='switch'&&!attr('className')?.split(/\s+/).includes('apple-switch'))add('shared-component',line(n),'Use shared apple-switch styling');
    if(role==='switch'&&(!attrs.has('aria-checked')||!attrs.has('aria-label')))add('switch-state',line(n),'Switch needs aria-checked and aria-label');
    if(tag==='dialog'&&path.basename(file)!=='modal.jsx')add('shared-component',line(n),'Use shared Modal');
    if(role==='dialog'&&path.basename(file)!=='modal.jsx')add('shared-component',line(n),'Use shared Modal');
    if(tag==='button'&&attr('className')?.split(/\s+/).includes('icon-button')&&!attrs.has('aria-label')&&!attrs.has('aria-labelledby'))add('accessible-name',line(n),'Icon button needs an accessible name');
    if(attr('className')?.split(/\s+/).includes('page-heading')&&path.basename(file)!=='page-heading.tsx')add('shared-component',line(n),'Use shared PageHeading');
    if(attr('className')?.split(/\s+/).includes('setting-row')&&path.basename(file)!=='settings-row.jsx')add('shared-component',line(n),'Use shared SettingRow');
    if(tag==='img'&&!attrs.has('alt'))add('accessible-name',line(n),'Image needs alt');
    const style=attrs.get('style')?.initializer;
    if(style&&ts.isJsxExpression(style)&&style.expression&&!ts.isObjectLiteralExpression(style.expression))add('dynamic-style',line(style),'style expression: '+style.expression.getText(ast));
    if(style&&ts.isJsxExpression(style)&&style.expression&&ts.isObjectLiteralExpression(style.expression))for(const p of style.expression.properties){
     if(ts.isSpreadAssignment(p)){add('dynamic-style',line(p),'style spread: '+p.expression.getText(ast));continue;}
     if(ts.isShorthandPropertyAssignment(p)){if(styleProps.test(p.name.text))add('dynamic-style',line(p),'style shorthand: '+p.name.text);continue;}
     if(!ts.isPropertyAssignment(p))continue;const key=p.name.getText(ast).replace(/['"]/g,''),value=literal(p.initializer);
     if(value===null&&styleProps.test(key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()))&&!p.initializer.getText(ast).includes('var(--'))add('dynamic-style',line(p),`style ${key}: ${p.initializer.getText(ast)}`);
     if(value!==null){const rule=styleViolation(key,ts.isNumericLiteral(p.initializer)&&!['fontWeight','lineHeight'].includes(key)?value+'px':value);if(rule)add(rule,line(p),`style ${key}: ${value}`);}
    }
    for(const k of ['className','class']){
     const a=attrs.get(k)?.initializer;if(!a)continue;
     const classes=a.getText(ast);
     if(/(?:^|[\s:"'`])-?(?:p[trblxy]?|m[trblxy]?|gap(?:-x|-y)?)-[1-9]|(?:^|[\s:"'`])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|rounded-(?:sm|md|lg|xl|[2-9]xl)|font-(?:thin|light|normal|medium|semibold|bold))\b/.test(classes))add('utility-token',line(a),'Use token-backed layout/typography classes');
     if(/(?:text|bg|border|ring|fill|stroke)-(?:red|blue|green|slate|gray|zinc|neutral|stone|orange|amber|yellow|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d/.test(classes)||/(?:bg|text|font|p[trblxy]?|m[trblxy]?|gap|rounded)-\[(?!var\(--)/.test(classes))add('utility-token',line(a),'Use semantic tokens instead of arbitrary or palette utility classes');
    }
   }
   ts.forEachChild(n,visit);
  }visit(ast);
 }
 if(file.endsWith('.html')){
  if(/style\s*=|<style\b/i.test(source))add('inline-html',1,'HTML styling belongs in audited stylesheets');
 }
 return issues;
}
export async function collectFiles(root){const out=[];async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const name=path.join(dir,entry.name);if(entry.isSymbolicLink())throw Error('UI symlink is not audited: '+name);if(entry.isDirectory())await walk(name);else out.push(name);}}await walk(root);return out.sort();}
export async function auditDesign(root=new URL('../',import.meta.url)){
 root=typeof root==='string'?root:fileURLToPath(root);
 const files=[...await collectFiles(path.join(root,'ui')),...await collectFiles(path.join(root,'public'))];const sources=await Promise.all(files.map(async file=>[path.relative(root,file).replaceAll('\\','/'),await readFile(file)]));
 const definitions=new Set([...renderDesignCSS().matchAll(/(--[\w-]+)\s*:/g)].map(m=>m[1]));
 for(const[file,data]of sources){const s=data.toString();if(file.endsWith('.css'))for(const[,token]of s.matchAll(/(--[\w-]+)\s*:/g))definitions.add(token);if(/\.(?:[jt]sx?|mjs)$/.test(file))for(const[,token]of s.matchAll(/["'](--[\w-]+)["']\s*[:,]/g))definitions.add(token);}
 const exceptions=JSON.parse(await readFile(path.join(root,'scripts/design-exceptions.json'),'utf8'));
 const assets=JSON.parse(await readFile(path.join(root,'scripts/design-assets.json'),'utf8'));
 const issues=[];const names=new Set(sources.map(([f])=>f));
 for(const name of Object.keys(assets))if(!names.has(name))issues.push({file:name,line:1,rule:'stale-asset',detail:'Remove deleted asset from the review manifest'});
 let checked=0;const used=new Set();
 for(const[file,data]of sources){
  if(file==='ui/design-system.mjs')continue;
  if(file==='ui/design-tokens.css'){if(data.toString()!==renderDesignCSS())issues.push({file,line:1,rule:'generated-tokens',detail:'Run build to regenerate tokens from the source'});continue;}
  if(file.startsWith('ui/assets/')||file.endsWith('.svg')){if(sourceExtensions.has(path.extname(file))){const digest=createHash('sha256').update(data).digest('hex');if(assets[file]?.sha256!==digest||!assets[file]?.reason)issues.push({file,line:1,rule:'asset-review',detail:'New or modified source asset requires review and a recorded digest'});}continue;}
  if(!sourceExtensions.has(path.extname(file))){if(/\.(?:vue|svelte|scss|sass|less|styl)$/.test(file))issues.push({file,line:1,rule:'unsupported-source',detail:'Add parser support before adopting a new UI source format'});continue;}checked++;
  for(const issue of auditSource(file,data.toString(),definitions)){const key=`${issue.file}|${issue.rule}|${issue.detail}`;if(exceptions[key]?.trim()){used.add(key);}else issues.push(issue);}
 }
 for(const key of Object.keys(exceptions))if(!used.has(key))issues.push({file:'scripts/design-exceptions.json',line:1,rule:'stale-exception',detail:key});
 const states=new Set();
 for(const[file,data]of sources.filter(([f])=>f.endsWith('.css'))){
  let tree;try{tree=postcss.parse(data.toString());}catch{continue;}
  tree.walkRules(rule=>{
   if(rule.selector.includes(':focus-visible')&&rule.nodes.some(d=>d.prop==='outline'&&!/^(none|0)$/.test(d.value)))states.add('focus');
   if(rule.selector.includes(':disabled')&&rule.nodes.some(d=>['opacity','color','cursor'].includes(d.prop)))states.add('disabled');
   if(/\[aria-(?:pressed|checked)=["']true/.test(rule.selector)&&rule.nodes.some(d=>['background','color','transform'].includes(d.prop)))states.add('selected');
   if(rule.selector==='*'&&rule.parent.type==='atrule'&&/prefers-reduced-motion:\s*reduce/.test(rule.parent.params)&&rule.nodes.some(d=>d.prop==='animation'&&d.value==='none'))states.add('reduced-motion');
  });
 }
 for(const state of ['focus','disabled','selected','reduced-motion'])if(!states.has(state))issues.push({file:'ui/',line:1,rule:'interaction-contract',detail:'Missing effective shared '+state+' styles'});
 return {files:sources.length,checked,reviewedAssets:Object.keys(assets).length,exceptions:used.size,issues};
}
export async function requireDesignAudit(){const result=await auditDesign();if(result.issues.length)throw Error(result.issues.map(i=>`${i.file}:${i.line} [${i.rule}] ${i.detail}`).join('\n'));return result;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await auditDesign();console.log(JSON.stringify(result,null,2));if(result.issues.length)process.exitCode=1;}
