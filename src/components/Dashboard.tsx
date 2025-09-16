import React, { useState, useEffect, useCallback } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonContent, IonPage, IonRefresher, IonRefresherContent, useIonToast, IonLabel, IonSpinner } from '@ionic/react';
import { Pie, Bar } from 'react-chartjs-2';
import { db, Expense } from '../db';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { toast } from 'react-toastify';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
interface DashboardProps {
  marginTop: number;
}
const Dashboard: React.FC<DashboardProps> = ({ marginTop }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<number>(0);
  const [expenseTotal, setExpenseTotal] = useState<number>(0);
  const [prevClosingBalance, setPrevClosingBalance] = useState<number>(0); // NEW
  const [currentBalance, setCurrentBalance] = useState<number>(0); // NEW
  const [loading, setLoading] = useState(true);
  const [present] = useIonToast();
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    localStorage.getItem('selectedGroupId') ? Number(localStorage.getItem('selectedGroupId')) : null
  );

  const showIncome = localStorage.getItem('show_income') === null
    ? true
    : localStorage.getItem('show_income') === 'true';

  function getMonthRange(offset = 0) {
    const now = new Date();
    const month = now.getMonth() + offset;
    const year = now.getFullYear() + Math.floor(month / 12);
    const realMonth = ((month % 12) + 12) % 12;
    const start = new Date(year, realMonth, 1, 0, 0, 0, 0);
    const end = new Date(year, realMonth + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }




  const loadExpenses = async () => {
    setLoading(true);
    try {
      let totalExpenses: Expense[] = [];

      totalExpenses = await db.expenses.toArray();

      setAllExpenses(totalExpenses);
    } catch (error) {
      toast.error(`Error loading expenses: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, []);






  // Combine all data loading into one function
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getMonthRange(0);

      // Fetch all expenses in one go
      const all = await db.expenses.toArray();

      // Calculate carry forward
      let carryForward = 0;
      all.forEach(e => {
        const expDate = new Date(e.date);
        if (expDate < start && (selectedGroupId === null ? true : e.groupId === selectedGroupId)) {
          if (e.type === 'income') carryForward += e.amount;
          else if (e.type === 'expense') carryForward -= e.amount;
        }
      });
      setPrevClosingBalance(carryForward);

      // Filter current month and selected group
      const monthExpenses = all.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= start && expDate <= end &&
          (selectedGroupId === null ? true : exp.groupId === selectedGroupId);
      });
      setExpenses(monthExpenses);

      // Calculate totals for selected group
      let incomeTotal = 0, expenseSum = 0;
      monthExpenses.forEach(e => {
        if (e.type === 'income') incomeTotal += e.amount;
        else if (e.type === 'expense') expenseSum += e.amount;
      });
      setIncome(incomeTotal);
      setExpenseTotal(expenseSum);
      setCurrentBalance(carryForward + incomeTotal - expenseSum);

    } catch (error) {
      present({
        message: `Error loading data: ${error}`,
        duration: 3000,
        color: 'danger',
        position: 'top'
      });
    } finally {
      setLoading(false);
    }
  }, [present, selectedGroupId]);

  useEffect(() => {
    loadData();
    const debouncedLoad = debounce(loadData, 200);
    db.on('changes', debouncedLoad);
    return () => db.on('changes').unsubscribe(debouncedLoad);
  }, [loadData]);

  const handleRefresh = (event: CustomEvent) => {
    loadData().then(() => {
      event.detail.complete();
    });
  };

  // Only show transactions for selected group
  const filteredExpenses = expenses.filter(exp =>
    selectedGroupId === null ? true : exp.groupId === selectedGroupId
  );

  const expenseByCategory = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieData = {
    labels: Object.keys(expenseByCategory),
    datasets: [
      {
        data: Object.values(expenseByCategory),
        backgroundColor: [
          "#1976d2", "#e53935", "#43a047", "#ffb300", "#8e24aa", "#00bcd4", "#fbc02d", "#d84315"
        ],
        borderWidth: 2,
        borderColor: "#fff"
      }
    ]
  };

  // Expense by group (if group property exists)
  const expenseByGroup = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      const group = (e as any).group || 'Other';
      acc[group] = (acc[group] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  // Group expenses by day and sum expenses for each day
  const dailyTotals: { [date: string]: number } = {};
  filteredExpenses.forEach(exp => {
    if (exp.type === 'expense') {
      const dayStr = new Date(exp.date).toLocaleDateString();
      dailyTotals[dayStr] = (dailyTotals[dayStr] || 0) + exp.amount;
    }
  });

  // Sort days ascending
  const sortedDays = Object.keys(dailyTotals).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Helper to get color by amount
  function getBarColor(value: number, min: number, max: number, index: number, total: number) {
  // Map value to a hue: 120 (green) to 0 (red)
  const ratio = (value - min) / (max - min || 1);
  const hue = 120 - ratio * 120; // 120=green, 0=red
  // Make each bar a bit different by shifting hue per index
  const uniqueHue = (hue + (index * (360 / total))) % 360;
  return `hsl(${uniqueHue}, 85%, 55%)`;
}

  // Prepare bar chart data for daily expenses with dynamic colors
  const minDaily = Math.min(...sortedDays.map(day => dailyTotals[day]));
  const maxDaily = Math.max(...sortedDays.map(day => dailyTotals[day]));
  const dailyBarData = {
    labels: sortedDays,
    datasets: [
      {
        label: 'Daily Expenses',
        data: sortedDays.map(day => dailyTotals[day]),
        backgroundColor: sortedDays.map((day, idx) =>
          getBarColor(dailyTotals[day], minDaily, maxDaily, idx, sortedDays.length)
        ),
        borderColor: sortedDays.map((day, idx) =>
          getBarColor(dailyTotals[day], minDaily, maxDaily, idx, sortedDays.length)
        ),
        borderWidth: 0,
        borderRadius: 0,
        barPercentage: 0.7,
        categoryPercentage: 0.7,
        hoverBackgroundColor: sortedDays.map((day, idx) =>
          getBarColor(dailyTotals[day], minDaily, maxDaily, idx, sortedDays.length)
        )
      }
    ]
  };

  const dailyBarOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `₹${context.parsed.y.toLocaleString()}`;
          }
        },
        backgroundColor: '#fff',
        titleColor: '#e53935',
        bodyColor: '#222',
        borderColor: '#e53935',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        shadowBlur: 8,
        shadowColor: 'rgba(229,57,53,0.15)'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#888", font: { size: 14, weight: "bold" } },
        grid: { color: "#f3f3f3" }
      },
      x: {
        ticks: { color: "#888", font: { size: 12, weight: "bold" } },
        grid: { color: "#f3f3f3" }
      }
    },
    animation: {
      duration: 1200,
      easing: 'easeOutQuart'
    }
  };

  useEffect(() => {
    const handleStorage = () => {
      const storedId = localStorage.getItem('selectedGroupId');
      setSelectedGroupId(storedId ? Number(storedId) : null);
    };
    window.addEventListener('storage', handleStorage);

    // Also poll for changes in same tab (Sidebar updates localStorage directly)
    const interval = setInterval(() => {
      const storedId = localStorage.getItem('selectedGroupId');
      if (
        (storedId ? Number(storedId) : null) !== selectedGroupId
      ) {
        setSelectedGroupId(storedId ? Number(storedId) : null);
      }
    }, 500);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [selectedGroupId]);

  return (
    <IonPage style={{ paddingTop: marginTop }}>
      <IonContent style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        {loading ? (
          <div className="ion-text-center ion-padding" style={{ minHeight: 300 }}>
            <IonSpinner name="crescent" color="primary" style={{ width: 48, height: 48 }} />
            <IonLabel style={{ display: 'block', marginTop: 16 }}>Loading...</IonLabel>
          </div>
        ) : (
          <IonGrid style={{ margin: '0 auto' /* removed overflow/height for scrolling */ }}>
            <IonRow>
              <IonCol size="12" sizeMd="6">
                <IonCard style={{
                  borderRadius: 18,
                  boxShadow: "0 2px 16px rgba(0, 4, 255, 0.08)",
                  background: "#fff"
                }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontWeight: 600, fontSize: 20, color: "#222" }}>Summary</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <Bar
                      data={dailyBarData}
                      options={{
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: { color: "#888", font: { size: 14, weight: "bold" } },
                            grid: { color: "#eee" }
                          },
                          x: {
                            ticks: { color: "#888", font: { size: 12, weight: "bold" } },
                            grid: { color: "#eee" }
                          }
                        }
                      }}
                    />
                    <div className="ion-margin-top" style={{ fontSize: 16, color: "#333" }}>
                      <p style={{ margin: 0, marginBottom: 4 }}>
                        <strong style={{ color: "#43a047" }}>Total Income:</strong> {showIncome ? `₹${income.toFixed(2)}` : '******'}
                      </p>
                      <p style={{ margin: 0, marginBottom: 4 }}>
                        <strong style={{ color: "#e53935" }}>Total Expenses:</strong> ₹{expenseTotal.toFixed(2)}
                      </p>
                      <p style={{ margin: 0, marginBottom: 4 }}>
                        <strong style={{ color: "#ffb300" }}>Opening Balance:</strong> {showIncome ? `₹${prevClosingBalance.toFixed(2)}` : '******'}
                      </p>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "#1976d2" }}>Current Balance:</strong> {showIncome ? `₹${currentBalance.toFixed(2)}` : '******'}
                      </p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
              <IonCol size="12" sizeMd="6">
                <IonCard style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
                  background: "#fff"
                }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontWeight: 600, fontSize: 20, color: "#222" }}>Expenses by Category</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    {Object.keys(expenseByCategory).length > 0 ? (
                      <Pie
                        data={pieData}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: {
                              position: 'right',
                              labels: {
                                color: "#444",
                                font: { size: 12 }
                              }
                            }
                          }
                        }}
                      />
                    ) : (
                      <div className="ion-text-center" style={{ color: "#888", fontSize: 15 }}>
                        <p>No expense data available</p>
                      </div>
                    )}
                    <div style={{ marginTop: 16 }}>
                      <h4 style={{ marginBottom: 8 }}>Category-wise Expenses (Current Month)</h4>
                      <ul style={{ paddingLeft: 16 }}>
                        {Object.entries(expenseByCategory).map(([cat, amt]) => (
                          <li key={cat} style={{ marginBottom: 4 }}>
                            <span style={{ fontWeight: 500 }}>{cat}:</span> ₹{amt.toFixed(2)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>

            <div className='extraSpace'></div>
          </IonGrid>
        )}
        <style>
          {`
            .chartjs-render-monitor {
              border-radius: 14px;
            }
            @media (max-width: 700px) {
              .chartjs-render-monitor {
                max-width: 100% !important;
              }
            }
          `}
        </style>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;