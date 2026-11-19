import { addDays, heat, mondayOf, timeLabel } from './index';

describe('calendar helpers', () => {
  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16'); // Thursday
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(mondayOf('2026-11-16')).toBe('2026-11-16');
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-11-30', -30)).toBe('2026-10-31');
  });
  it('renders times in London time (GMT in winter, BST in summer)', () => {
    expect(timeLabel('2026-11-23T08:00:00.000Z')).toBe('08:00');
    expect(timeLabel('2026-07-01T08:00:00.000Z')).toBe('09:00');
  });
  it('colours fully free green and fully used red; closed days grey', () => {
    expect(heat(0, 10).bg).toContain('hsl(125');
    expect(heat(10, 10).bg).toContain('hsl(0');
    expect(heat(0, 0).bg).toBe('#f1f1f1');
  });
});
