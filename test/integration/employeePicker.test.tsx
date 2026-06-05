import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmployeePicker } from '@ui/components/EmployeePicker';
import { anEmployee } from '@test/harness/builders';

const emps = [
  anEmployee({ id: 'e1', name: '김철수', employeeNumber: '2018-0101', department: '생산1팀' }),
  anEmployee({ id: 'e2', name: '이영희', employeeNumber: '2020-0203', department: '품질관리팀' }),
];

describe('EmployeePicker 검색', () => {
  it('이름으로 검색해 후보를 좁힌다', async () => {
    render(<EmployeePicker employees={emps} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.type(input, '영희');
    expect(screen.getByText('이영희')).toBeInTheDocument();
    expect(screen.queryByText('김철수')).not.toBeInTheDocument();
  });

  it('사번으로 검색하고 선택하면 onChange(id)가 호출된다', async () => {
    const onChange = vi.fn();
    render(<EmployeePicker employees={emps} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.click(input);
    await userEvent.type(input, '2018');
    await userEvent.click(screen.getByText('김철수'));
    expect(onChange).toHaveBeenCalledWith('e1');
  });
});
