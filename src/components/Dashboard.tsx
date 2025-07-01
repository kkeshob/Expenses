import React, { useState, useEffect, useCallback } from 'react';
import { IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonContent, IonPage, IonRefresher, IonRefresherContent, useIonToast, IonLabel } from '@ionic/react';
import { Pie, Bar } from 'react-chartjs-2';
import { db, Expense } from '../db';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
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

  // Efficient data loader: only current month, balance adjusted by previous month
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Calculate carry forward as the sum of all previous months' net balances
      const { start } = getMonthRange(0); // Start of current month
      const allPrevExpenses = await db.expenses
        .where('date')
        .below(start.toISOString())
        .toArray();

      let carryForward = 0;
      for (const e of allPrevExpenses) {
        if (e.type === 'income') carryForward += e.amount;
        else if (e.type === 'expense') carryForward -= e.amount;
      }
      setPrevClosingBalance(carryForward);

      // Current month
      const { start: currStart, end: currEnd } = getMonthRange(0);
      const monthExpenses = await db.expenses
        .where('date')
        .between(currStart.toISOString(), currEnd.toISOString(), true, true)
        .toArray();
      setExpenses(monthExpenses);

      let incomeTotal = 0, expenseSum = 0;
      for (const e of monthExpenses) {
        if (e.type === 'income') incomeTotal += e.amount;
        else if (e.type === 'expense') expenseSum += e.amount;
      }
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
  }, [present]);

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

  // Only include income if showIncome is true
  const filteredExpenses = showIncome
    ? expenses
    : expenses.filter(e => e.type !== 'income');

  // Expense by category
  const expenseByCategory = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  // Expense by group (if group property exists)
  const expenseByGroup = filteredExpenses
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      const group = (e as any).group || 'Other';
      acc[group] = (acc[group] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

  const pieColors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#8AC24A', '#607D8B', '#E91E63', '#9C27B0'
  ];

  const pieData = {
    labels: Object.keys(expenseByCategory),
    datasets: [
      {
        data: Object.values(expenseByCategory),
        backgroundColor: pieColors,
        hoverBackgroundColor: pieColors
      }
    ]
  };

  const barData = {
    labels: ['Income', 'Expenses', 'Prev. Closing', 'Current Balance'],
    datasets: [
      {
        label: 'Amount',
        data: showIncome ? [income, expenseTotal, prevClosingBalance, currentBalance] : [0, expenseTotal, prevClosingBalance, currentBalance],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 99, 132, 0.7)',
          'rgba(255, 206, 86, 0.7)',
          'rgba(54, 162, 235, 0.7)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(54, 162, 235, 1)'
        ],
        borderWidth: 2,
        borderRadius: 12,
        barPercentage: 0.6,
        categoryPercentage: 0.5
      }
    ]
  };

  return (
    <IonPage style={{ paddingTop: marginTop }}>
      <IonContent style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading...</IonLabel>
          </div>
        ) : (
          <IonGrid style={{ margin: '0 auto' /* removed overflow/height for scrolling */ }}>
            <IonRow>
              <IonCol size="12" sizeMd="6">
                <IonCard style={{
                  borderRadius: 18,
                  boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
                  background: "#fff"
                }}>
                  <IonCardHeader>
                    <IonCardTitle style={{ fontWeight: 600, fontSize: 20, color: "#222" }}>Summary</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <Bar
                      data={barData}
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
                            ticks: { color: "#888", font: { size: 14, weight: "bold" } },
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