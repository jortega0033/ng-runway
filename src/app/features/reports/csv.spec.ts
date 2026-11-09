import { CSV_BOM, escapeCsvField, toCsv, type CsvColumn } from './csv';

interface Row {
  name: string;
  hours: number | null;
}

const columns: CsvColumn<Row>[] = [
  { header: 'Team', value: (r) => r.name },
  { header: 'Hours', value: (r) => r.hours },
];

describe('escapeCsvField', () => {
  it('leaves plain text alone', () => {
    expect(escapeCsvField('Floor Amsterdam')).toBe('Floor Amsterdam');
    expect(escapeCsvField(12.5)).toBe('12.5');
  });

  it('quotes fields with commas, line breaks and doubles the quotes', () => {
    expect(escapeCsvField('Sales, retail')).toBe('"Sales, retail"');
    expect(escapeCsvField('Line one\nline two')).toBe('"Line one\nline two"');
    expect(escapeCsvField('Carriage\rreturn')).toBe('"Carriage\rreturn"');
    expect(escapeCsvField('The "night" team')).toBe('"The ""night"" team"');
  });

  it('stops spreadsheet formulas in text but keeps negative numbers', () => {
    expect(escapeCsvField('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(escapeCsvField('@cmd')).toBe("'@cmd");
    expect(escapeCsvField('-1+2')).toBe("'-1+2");
    expect(escapeCsvField(-1.5)).toBe('-1.5');
  });

  it('writes null and undefined as an empty field', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and a header line', () => {
    const csv = toCsv([], columns);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_BOM}Team,Hours\r\n`);
  });

  it('writes one line per row with CRLF line ends', () => {
    const csv = toCsv(
      [
        { name: 'Floor', hours: 120.5 },
        { name: 'Café, "Terrace"', hours: null },
      ],
      columns,
    );
    expect(csv).toBe(`${CSV_BOM}Team,Hours\r\nFloor,120.5\r\n"Café, ""Terrace""",\r\n`);
  });

  it('escapes header cells too', () => {
    const csv = toCsv([], [{ header: 'Cost, EUR', value: () => '' }]);
    expect(csv).toBe(`${CSV_BOM}"Cost, EUR"\r\n`);
  });
});
