/**
 * InlineEditCell Component — Unit Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineEditCell } from '@/components/assumptions/InlineEditCell';

describe('InlineEditCell', () => {
  it('renders display value initially', () => {
    render(<InlineEditCell value={1000} onChange={() => {}} />);
    expect(screen.getByText(/1\.000|1,000|1000/)).toBeDefined();
  });

  it('enters edit mode on click', () => {
    render(<InlineEditCell value={500} onChange={() => {}} />);
    const display = screen.getByText(/500/);
    fireEvent.click(display);
    const input = screen.getByRole('spinbutton');
    expect(input).toBeDefined();
    expect((input as HTMLInputElement).value).toBe('500');
  });

  it('calls onChange on blur with new value', () => {
    const onChange = vi.fn();
    render(<InlineEditCell value={100} onChange={onChange} />);
    fireEvent.click(screen.getByText(/100/));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '200' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(200);
  });

  it('calls onChange on Enter key', () => {
    const onChange = vi.fn();
    render(<InlineEditCell value={100} onChange={onChange} />);
    fireEvent.click(screen.getByText(/100/));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(300);
  });

  it('cancels on Escape key', () => {
    const onChange = vi.fn();
    render(<InlineEditCell value={100} onChange={onChange} />);
    fireEvent.click(screen.getByText(/100/));
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onChange).not.toHaveBeenCalled();
    // Should show original value again
    expect(screen.getByText(/100/)).toBeDefined();
  });

  it('does not call onChange if value unchanged', () => {
    const onChange = vi.fn();
    render(<InlineEditCell value={100} onChange={onChange} />);
    fireEvent.click(screen.getByText(/100/));
    const input = screen.getByRole('spinbutton');
    fireEvent.blur(input); // blur without changing
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses custom format function', () => {
    render(
      <InlineEditCell
        value={1234}
        onChange={() => {}}
        format={v => `R$ ${v.toFixed(2)}`}
      />
    );
    expect(screen.getByText('R$ 1234.00')).toBeDefined();
  });
});
