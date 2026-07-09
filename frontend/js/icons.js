// Datei-Typ-Icons. Das `iconFor`-Ergebnis ist ein <svg><use>-Element,
// das per `innerHTML` in renderRow eingehängt wird. Die Symbole leben
// in /icons/sprite.svg.

const SPRITE = '/icons/sprite.svg';

const EXT_MAP = {
  pdf: 'file-pdf',
  txt:'file-text', md:'file-text', rtf:'file-text', log:'file-text', doc:'file-text', docx:'file-text', odt:'file-text',
  csv:'file-spreadsheet', tsv:'file-spreadsheet', xls:'file-spreadsheet', xlsx:'file-spreadsheet', ods:'file-spreadsheet',
  png:'file-image', jpg:'file-image', jpeg:'file-image', gif:'file-image', webp:'file-image', svg:'file-image', bmp:'file-image', tiff:'file-image', heic:'file-image',
  mp3:'file-music', wav:'file-music', flac:'file-music', m4a:'file-music', ogg:'file-music', aac:'file-music',
  mp4:'file-video', mov:'file-video', avi:'file-video', mkv:'file-video', webm:'file-video', m4v:'file-video',
  zip:'file-archive', tar:'file-archive', gz:'file-archive', tgz:'file-archive', rar:'file-archive', '7z':'file-archive', bz2:'file-archive', xz:'file-archive',
  json:'file-code', yaml:'file-code', yml:'file-code', xml:'file-code', toml:'file-code', ini:'file-code', env:'file-code',
  js:'file-code', mjs:'file-code', cjs:'file-code', ts:'file-code', tsx:'file-code', jsx:'file-code',
  py:'file-code', rb:'file-code', go:'file-code', rs:'file-code', java:'file-code', kt:'file-code',
  c:'file-code', cpp:'file-code', cc:'file-code', h:'file-code', hpp:'file-code', sh:'file-code', bash:'file-code', zsh:'file-code',
  html:'file-code', htm:'file-code', css:'file-code', scss:'file-code', less:'file-code',
};

export function iconFor(name) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  const id = EXT_MAP[ext] || 'file';
  return `<svg class="icon" width="18" height="18" aria-hidden="true"><use href="${SPRITE}#${id}"/></svg>`;
}
