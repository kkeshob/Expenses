import Dashboard from '../Dashboard';

// src/components/Dashboard.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import "@testing-library/jest-dom";

// src/components/Dashboard.test.tsx
// --- MockTooltip interface and initializer ---
// --- Mocks for chart.js and react-chartjs-2 ---
jest.mock("react-chartjs-2", () => ({
  Pie: (props: any) => <div data-testid="mock-pie">{JSON.stringify(props.data)}</div>,
  Bar: (props: any) => <div data-testid="mock-bar">{JSON.stringify(props.data)}</div>,
}));

// --- Mock db and its methods ---
const mockToArray = jest.fn();
const mockWhere = jest.fn(() => ({
  between: jest.fn(() => ({
    toArray: mockToArray,
  })),
}));
const mockDbOn = jest.fn();
const mockDbOnUnsubscribe = jest.fn();

jest.mock("../../db", () => {
  return {
    db: {
      expenses: {
        where: mockWhere,
        toArray: mockToArray,
      },
      on: jest.fn((event: string, cb: any) => {
        mockDbOn(event, cb);
        return { unsubscribe: mockDbOnUnsubscribe };
      }),
    },
    Expense: {} as any,
  };
});

// --- Mock localStorage ---
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// --- Mock alert ---
window.alert = jest.fn();

// --- Helper: Generate expenses ---

describe('Dashboard() Dashboard method', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    (window.alert as jest.Mock).mockClear();
  });

  // --- Happy Path Tests ---
  describe('Happy paths', () => {
    it('renders loading state initially', () => {
      // Test: Should show loading spinner before data loads
      mockToArray.mockResolvedValueOnce([] as any as never);
      render(<Dashboard marginTop={10} />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders summary, bar, pie, and groupwise sections with data', async () => {
      // Test: Should render all main sections with correct data
      // Setup: Previous-previous month, previous month, current month
      const now = new Date();
      const prevPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      // Previous-previous month: 200 income, 50 expense
      mockToArray
        .mockResolvedValueOnce([
          { type: 'income', amount: 200, date: prevPrevMonth },
          { type: 'expense', amount: 50, date: prevPrevMonth },
        ] as any as never)
        // Previous month: 100 income, 30 expense
        .mockResolvedValueOnce([
          { type: 'income', amount: 100, date: prevMonth },
          { type: 'expense', amount: 30, date: prevMonth },
        ] as any as never)
        // All expenses: current month
        .mockResolvedValueOnce([
          { type: 'income', amount: 500, date: currMonth, category: 'Salary', group: 'Work' },
          { type: 'expense', amount: 100, date: currMonth, category: 'Food', group: 'Friends' },
          { type: 'expense', amount: 50, date: currMonth, category: 'Travel', group: 'Family' },
        ] as any as never);

      render(<Dashboard marginTop={20} />);
      // Wait for loading to finish
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

      // Summary section
      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Total Income:')).toBeInTheDocument();
      expect(screen.getByText('Total Expenses:')).toBeInTheDocument();
      expect(screen.getByText('Carry Forward (Prev Month):')).toBeInTheDocument();
      expect(screen.getByText('Current Balance:')).toBeInTheDocument();

      // Bar chart
      expect(screen.getByTestId('mock-bar')).toBeInTheDocument();

      // Pie chart
      expect(screen.getByTestId('mock-pie')).toBeInTheDocument();

      // Category-wise list
      expect(screen.getByText('Category-wise Expenses (Current Month)')).toBeInTheDocument();
      expect(screen.getByText('Food:')).toBeInTheDocument();
      expect(screen.getByText('Travel:')).toBeInTheDocument();

      // Groupwise section
      expect(screen.getByText('Groupwise Total Expenses (Current Month)')).toBeInTheDocument();
      expect(screen.getByText('Friends:')).toBeInTheDocument();
      expect(screen.getByText('Family:')).toBeInTheDocument();
    });

    it('shows masked values when show_income is false in localStorage', async () => {
      // Test: Should mask income, carry forward, and balance when show_income is false
      localStorage.setItem('show_income', 'false');
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never) // prevPrev
        .mockResolvedValueOnce([] as any as never) // prev
        .mockResolvedValueOnce([
          { type: 'income', amount: 1000, date: currMonth, category: 'Salary', group: 'Work' },
          { type: 'expense', amount: 200, date: currMonth, category: 'Food', group: 'Friends' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

      // Masked values
      expect(screen.getByText('******')).toBeInTheDocument();
      expect(screen.getByText('₹200.00')).toBeInTheDocument(); // Expense always shown
    });

    it('shows all values when show_income is true in localStorage', async () => {
      // Test: Should show all values when show_income is true
      localStorage.setItem('show_income', 'true');
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never) // prevPrev
        .mockResolvedValueOnce([] as any as never) // prev
        .mockResolvedValueOnce([
          { type: 'income', amount: 1000, date: currMonth, category: 'Salary', group: 'Work' },
          { type: 'expense', amount: 200, date: currMonth, category: 'Food', group: 'Friends' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

      // All values visible
      expect(screen.getByText('₹1000.00')).toBeInTheDocument();
      expect(screen.getByText('₹200.00')).toBeInTheDocument();
    });

    it('renders "No expense data available" when no expenses in current month', async () => {
      // Test: Should show "No expense data available" if no expenses
      mockToArray
        .mockResolvedValueOnce([] as any as never) // prevPrev
        .mockResolvedValueOnce([] as any as never) // prev
        .mockResolvedValueOnce([] as any as never); // all

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

      expect(screen.getByText('No expense data available')).toBeInTheDocument();
      expect(screen.getByText('No groupwise expense data available')).toBeInTheDocument();
    });

    it('renders with different marginTop prop', async () => {
      // Test: Should apply marginTop prop to root div
      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never);

      const { container } = render(<Dashboard marginTop={123} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(container.firstChild).toHaveStyle('padding-top: 123px');
    });

    it('subscribes and unsubscribes to db changes', async () => {
      // Test: Should subscribe and unsubscribe to db.on("changes")
      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never);

      const { unmount } = render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(mockDbOn).toHaveBeenCalledWith('changes', expect.any(Function));
      unmount();
      expect(mockDbOnUnsubscribe).toHaveBeenCalled();
    });
  });

  // --- Edge Case Tests ---
  describe('Edge cases', () => {
    it('handles expenses with missing group property', async () => {
      // Test: Should group such expenses under "Other"
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'expense', amount: 100, date: currMonth, category: 'Misc' }, // no group
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('Other:')).toBeInTheDocument();
      expect(screen.getByText('Misc:')).toBeInTheDocument();
    });

    it('handles expenses with zero and negative amounts', async () => {
      // Test: Should display zero and negative values correctly
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'expense', amount: 0, date: currMonth, category: 'Zero', group: 'ZeroGroup' },
          { type: 'expense', amount: -50, date: currMonth, category: 'Negative', group: 'NegGroup' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('Zero:')).toBeInTheDocument();
      expect(screen.getByText('Negative:')).toBeInTheDocument();
      expect(screen.getByText('ZeroGroup:')).toBeInTheDocument();
      expect(screen.getByText('NegGroup:')).toBeInTheDocument();
      expect(screen.getByText('₹0.00')).toBeInTheDocument();
      expect(screen.getByText('₹-50.00')).toBeInTheDocument();
    });

    it('handles only income, no expenses', async () => {
      // Test: Should show no expense data if only income present
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'income', amount: 1000, date: currMonth, category: 'Salary', group: 'Work' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('No expense data available')).toBeInTheDocument();
      expect(screen.getByText('No groupwise expense data available')).toBeInTheDocument();
    });

    it('handles only expenses, no income', async () => {
      // Test: Should show correct totals and charts with only expenses
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'expense', amount: 100, date: currMonth, category: 'Food', group: 'Friends' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('Food:')).toBeInTheDocument();
      expect(screen.getByText('Friends:')).toBeInTheDocument();
      expect(screen.getByText('₹100.00')).toBeInTheDocument();
    });

    it('alerts and recovers from db error', async () => {
      // Test: Should alert on error and stop loading
      mockToArray
        .mockRejectedValueOnce(new Error('DB error') as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Error loading data:')));
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
    });

    it('handles expenses with unknown type', async () => {
      // Test: Should ignore unknown types
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'unknown', amount: 100, date: currMonth, category: 'Other', group: 'Other' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('No expense data available')).toBeInTheDocument();
      expect(screen.getByText('No groupwise expense data available')).toBeInTheDocument();
    });

    it('handles expenses with missing category', async () => {
      // Test: Should group under undefined category
      const now = new Date();
      const currMonth = new Date(now.getFullYear(), now.getMonth(), 10).toISOString();

      mockToArray
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([] as any as never)
        .mockResolvedValueOnce([
          { type: 'expense', amount: 100, date: currMonth, group: 'Friends' },
        ] as any as never);

      render(<Dashboard marginTop={0} />);
      await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
      expect(screen.getByText('Friends:')).toBeInTheDocument();
      expect(screen.getByText('₹100.00')).toBeInTheDocument();
    });
  });
});