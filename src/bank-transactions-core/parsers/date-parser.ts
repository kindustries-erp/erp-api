export function parseVNLocalDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    // ExcelJS reads dates as UTC. For example, "2026-07-30 14:59:13" in Excel
    // becomes 2026-07-30T14:59:13.000Z in Node.js.
    // Since this is Vietnam time (+7), we must subtract 7 hours to get the real UTC time.
    return new Date(val.getTime() - 7 * 60 * 60 * 1000);
  }

  if (typeof val === 'string') {
    let dateStr = val.trim();
    let year: number | undefined;
    let month: number | undefined;
    let day: number | undefined;
    let h = 0,
      m = 0,
      s = 0;

    // Support DD/MM/YYYY HH:mm:ss or YYYY-MM-DD HH:mm:ss
    const parts = dateStr.split(/[ T]/);
    const datePart = parts[0];
    const timePart = parts[1];

    if (datePart.includes('/')) {
      const dParts = datePart.split('/');
      if (dParts.length === 3) {
        day = parseInt(dParts[0]);
        month = parseInt(dParts[1]);
        year = parseInt(dParts[2]);
      }
    } else if (datePart.includes('-')) {
      const dParts = datePart.split('-');
      if (dParts.length === 3) {
        year = parseInt(dParts[0]);
        month = parseInt(dParts[1]);
        day = parseInt(dParts[2]);
      }
    }

    if (timePart) {
      const tParts = timePart.split(':');
      h = parseInt(tParts[0] || '0');
      m = parseInt(tParts[1] || '0');
      s = parseInt(tParts[2] || '0');
    }

    if (year && month && day && !isNaN(year) && !isNaN(month) && !isNaN(day)) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      // Format as YYYY-MM-DDTHH:mm:ss+07:00 to explicitly set the timezone to GMT+7
      const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:${pad(s)}+07:00`;
      const d = new Date(isoStr);
      if (!isNaN(d.getTime())) return d;
    }

    const d2 = new Date(val);
    if (!isNaN(d2.getTime())) {
      // Fallback if the string couldn't be parsed by our custom logic.
      return d2;
    }
  }

  return null;
}
