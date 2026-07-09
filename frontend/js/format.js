export const fmtSize = b => {
  if (b < 1024) return b + ' B';
  if (b < 1024 ** 2) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1024 ** 3) return (b / 1024 ** 2).toFixed(1) + ' MB';
  return (b / 1024 ** 3).toFixed(2) + ' GB';
};

export const fmtTime = ts => new Date(ts * 1000).toLocaleString('de-DE', {
  day: '2-digit', month: '2-digit', year: '2-digit',
  hour: '2-digit', minute: '2-digit',
});
