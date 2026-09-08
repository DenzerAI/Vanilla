import React from 'react';
import './html-preview.css';

type Props = {
  path: string;
  scope?: string;
  revision?: number;
  onLoad?: () => void;
  onError?: () => void;
};

export function HtmlPreview({path, scope = 'workspace', revision = 0, onLoad, onError}: Props) {
  const query = new URLSearchParams({path, scope, revision: String(revision)});
  return <iframe className="html-document-preview" title={'HTML-Vorschau: ' + path.split('/').pop()}
    src={'/api/file/preview?' + query} sandbox="allow-scripts" referrerPolicy="no-referrer"
    onLoad={onLoad} onError={onError}/>;
}
