export const loaderVariants = [
  ['ascii','ASCII'], ['dither','Dither'], ['spinner','Spinner'], ['dots','Dots'],
  ['bars','Bars'], ['dot-matrix','Dot Matrix'], ['morph','Morph'], ['comet','Comet'],
  ['metaballs','Metaballs'], ['newton','Newton'], ['helix','Helix'], ['scramble','Scramble'],
  ['percent','Percent'], ['ascii-line','ASCII Line'], ['ascii-braille','ASCII Braille'],
  ['ascii-blocks','ASCII Blocks'], ['ascii-bounce','ASCII Bounce'],
];
export const loaderOptions = {
  loaderVariant: {default:'ascii',options:loaderVariants},
  loaderSize: {default:'standard',options:[['small','Klein'],['standard','Standard'],['large','Groß']]},
  loaderSpeed: {default:'normal',options:[['slow','Ruhig'],['normal','Normal'],['fast','Schnell']]},
};
