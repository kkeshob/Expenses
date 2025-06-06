import React, { useState, useEffect, useCallback } from 'react';
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  useIonToast,
  IonLabel
} from '@ionic/react';
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
  marginTop:number;
}
const Dashboard: React.FC<DashboardProps> = ({marginTop}) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [income, setIncome] = useState<number>(0);
  const [expenseTotal, setExpenseTotal] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [present] = useIonToast();
  const [showIncome] = useState(() => {
    const stored = localStorage.getItem('show_income');
    return stored === null ? true : stored === 'true';
  });

  // Helper to get start and end of a month
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
      // Previous month
      const { start: prevStart, end: prevEnd } = getMonthRange(-1);
      const prevExpenses = await db.expenses
        .where('date')
        .between(prevStart.toISOString(), prevEnd.toISOString(), true, true)
        .toArray();

      let prevIncomeTotal = 0, prevExpenseSum = 0;
      for (const e of prevExpenses) {
        if (e.type === 'income') prevIncomeTotal += e.amount;
        else if (e.type === 'expense') prevExpenseSum += e.amount;
      }
      const prevNetBalance = prevIncomeTotal - prevExpenseSum;

      // Current month
      const { start, end } = getMonthRange(0);
      const allExpenses = await db.expenses.toArray();
      const monthExpenses = allExpenses.filter(e =>
        new Date(e.date) >= start && new Date(e.date) <= end
      );
      setExpenses(monthExpenses);

      let incomeTotal = 0, expenseSum = 0;
      for (const e of monthExpenses) {
        if (e.type === 'income') incomeTotal += e.amount;
        else if (e.type === 'expense') expenseSum += e.amount;
      }
      setIncome(incomeTotal);
      setExpenseTotal(expenseSum);
      setBalance(prevNetBalance + incomeTotal - expenseSum); // Carry forward previous net balance

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

  // Initial load and DB change listener (debounced)
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

  // Prepare data for charts (current month only)
  const expenseByCategory = expenses
    .filter(e => e.type === 'expense')
    .reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
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
    labels: ['Income', 'Expenses', 'Balance'],
    datasets: [
      {
        label: 'Amount',
        data: [income, expenseTotal, balance],
        backgroundColor: [
          'rgba(75, 192, 192, 0.7)',
          'rgba(255, 99, 132, 0.7)',
          'rgba(54, 162, 235, 0.7)'
        ],
        borderColor: [
          'rgba(75, 192, 192, 1)',
          'rgba(255, 99, 132, 1)',
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
    <IonPage style={{ paddingTop: marginTop }} >
      <IonContent style={{ background: "#f6f8fa"}} >
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading...</IonLabel>
          </div>
        ) : (
          <IonGrid style={{ overflow: "hidden", margin: '0 auto',height:'80vh' }}>
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
                      data={{
                        ...barData,
                        datasets: [{
                          ...barData.datasets[0],
                          data: showIncome ? [income, expenseTotal, balance] : [0, expenseTotal, 0]
                        }]
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { display: false }
                        },
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
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "#1976d2" }}>Balance (Carry Forward):</strong> {showIncome ? `₹${balance.toFixed(2)}` : '******'}
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
                                font: { size: 12
                                 }
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
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
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