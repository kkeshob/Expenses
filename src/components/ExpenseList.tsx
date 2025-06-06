import React, { useState, useEffect } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonBadge,
  IonIcon,
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonAvatar,
  IonModal,
  IonInput,
  IonDatetime,
  IonText
} from '@ionic/react';
import { trash, pencil } from 'ionicons/icons';
import { db, Expense, Category } from '../db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core'; // <-- add this
import Chart from 'chart.js/auto';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';

interface ExpenseListProps {
  selectedGroupId: number | null;
  marginTop:number;
}

const ExpenseList: React.FC<ExpenseListProps> = ({ selectedGroupId,marginTop }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  // REMOVE: const [present] = useIonToast();

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString());
  const [showDateModal, setShowDateModal] = useState(false);
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Delete confirmation modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);
  const [showIncome, setShowIncome] = useState(() => {
    const stored = localStorage.getItem('show_income');
    return stored === null ? true : stored === 'true';
  });
  let currentGroupId = Number(localStorage.getItem('selectedGroupId'));


  // Handler for delete confirmation modal
  const handleDeleteExpense = async () => {
    if (deletingExpense && deletingExpense.id !== undefined) {
      await deleteExpense(deletingExpense.id);
      setDeleteModalOpen(false);
      setDeletingExpense(null);
      await loadExpenses(); // <-- reload after delete
    }
  };

  useEffect(() => {
    db.categories.toArray().then(setCategories);
  }, []);

  const getCategory = (name: string) => categories.find(cat => cat.name === name);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let allExpenses = [];
      if (selectedGroupId !== null) {
        allExpenses = await db.expenses.where('groupId').equals(selectedGroupId).toArray();
      } else {
        allExpenses = await db.expenses.toArray();
      }
      setExpenses(allExpenses);
    } catch (error) {
      toast.error(`Error loading expenses: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteExpense = async (id: number) => {
    try {
      await db.expenses.delete(id);
      setExpenses(expenses.filter(exp => exp.id !== id));
      toast.success('Transaction deleted successfully');
    } catch (error) {
      toast.error(`Error deleting transaction: ${error}`);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditAmount(expense.amount);
    setEditDescription(expense.description ?? '');
    setEditCategory(expense.category);
    setEditDate(typeof expense.date === 'string' ? expense.date : new Date(expense.date).toISOString());
    setEditModalOpen(true);
  };

  // Reload expenses when group, category, or search changes
  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, [searchText, selectedCategory, currentGroupId]);

  // Reload expenses when Dexie DB changes (add/edit/delete)
  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

  // Reload expenses after editing or deleting
  const handleEditSave = async () => {
    if (!editingExpense) return;
    if (editAmount <= 0) {
      toast.warning('Amount must be greater than 0');
      return;
    }
    try {
      await db.expenses.update(editingExpense.id!, {
        amount: editAmount,
        description: editDescription,
        category: editCategory,
        date: new Date(editDate)
      });
      toast.success('Transaction updated successfully');
      setEditModalOpen(false);
      setEditingExpense(null);
      await loadExpenses(); // <-- reload after edit
    } catch (error) {
      toast.error(`Error updating transaction: ${error}`);
    }
  };

  const handleRefresh = (event: CustomEvent) => {
    loadExpenses().then(() => {
      event.detail.complete();
    });
  };

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, [searchText, selectedCategory]);

  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

  const filteredExpenses = showIncome
    ? expenses
    : expenses.filter(exp => exp.type !== 'income');

  const totalFilteredExpenses = filteredExpenses
    .filter(exp => exp.type === 'expense')
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Helper to get group name by id
  const getGroupName = (groupId: number | null | undefined, accounts: { id: number; name: string }[]) => {
    if (!groupId) return '';
    const group = accounts.find(acc => acc.id === groupId);
    return group ? group.name : '';
  };

  // Generate and download monthly PDF report
  const generateMonthlyPDFReport = async () => {
    const [year, month] = reportMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    // Previous month range
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = new Date(prevYear, prevMonth - 1, 1);
    const prevEnd = new Date(prevYear, prevMonth, 1);

    // Current and previous month expenses
    const filtered = filteredExpenses.filter(exp => {
      const date = new Date(exp.date);
      return date >= start && date < end;
    });
    const prevFiltered = filteredExpenses.filter(exp => {
      const date = new Date(exp.date);
      return date >= prevStart && date < prevEnd;
    });

    // Calculate previous month net balance for the selected group
    let prevMonthExpenses = [];
    if (selectedGroupId !== null) {
      prevMonthExpenses = await db.expenses
        .where('groupId').equals(selectedGroupId)
        .and(exp => {
          const date = new Date(exp.date);
          return date >= prevStart && date < prevEnd;
        })
        .toArray();
    } else {
      prevMonthExpenses = expenses.filter(exp => {
        const date = new Date(exp.date);
        return date >= prevStart && date < prevEnd;
      });
    }

    const prevIncome = prevMonthExpenses
      .filter(exp => exp.type === 'income')
      .reduce((sum, exp) => sum + exp.amount, 0);

    const prevExpense = prevMonthExpenses
      .filter(exp => exp.type === 'expense')
      .reduce((sum, exp) => sum + exp.amount, 0);

    const prevNetBalance = prevIncome - prevExpense;

    // Prepare data for charts
    const expenseByCategory: { [cat: string]: number } = {};
    const incomeByCategory: { [cat: string]: number } = {};
    const dailyTotals: { [date: string]: { income: number, expense: number } } = {};
    const prevDailyTotals: { [date: string]: { income: number, expense: number } } = {};

    filtered.forEach(exp => {
      const day = new Date(exp.date).getDate();
      if (!dailyTotals[day]) dailyTotals[day] = { income: 0, expense: 0 };
      if (exp.type === 'expense') {
        expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
        dailyTotals[day].expense += exp.amount;
      } else {
        incomeByCategory[exp.category] = (incomeByCategory[exp.category] || 0) + exp.amount;
        dailyTotals[day].income += exp.amount;
      }
    });

    prevFiltered.forEach(exp => {
      const day = new Date(exp.date).getDate();
      if (!prevDailyTotals[day]) prevDailyTotals[day] = { income: 0, expense: 0 };
      if (exp.type === 'expense') {
        prevDailyTotals[day].expense += exp.amount;
      } else {
        prevDailyTotals[day].income += exp.amount;
      }
    });

    // Helper to create chart and return base64 image
    async function createChart(type: 'pie' | 'bar' | 'line', data: any, options: any): Promise<string> {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      document.body.appendChild(canvas);
      const chart = new Chart(canvas, {
        type,
        data,
        options: {
          ...options,
          plugins: {
            ...options.plugins,
            legend: {
              ...options.plugins?.legend,
              labels: {
                font: { size: 14, family: 'Arial, sans-serif', weight: 'bold' },
                color: '#222'
              }
            },
            title: {
              ...options.plugins?.title,
              font: { size: 16, family: 'Arial, sans-serif', weight: 'bold' },
              color: '#222'
            }
          },
          scales: options.scales
            ? {
              ...options.scales,
              x: {
                ...options.scales.x,
                ticks: { font: { size: 13, family: 'Arial, sans-serif' }, color: '#222' }
              },
              y: {
                ...options.scales.y,
                ticks: { font: { size: 13, family: 'Arial, sans-serif' }, color: '#222' }
              }
            }
            : undefined,
          animation: false,
          responsive: false,
          devicePixelRatio: 2
        }
      });
      await new Promise(res => setTimeout(res, 400));
      const img = canvas.toDataURL('image/png');
      chart.destroy();
      document.body.removeChild(canvas);
      return img;
    }

    // Pie chart: Expenses by category
    const pieImg = await createChart('pie', {
      labels: Object.keys(expenseByCategory),
      datasets: [{
        data: Object.values(expenseByCategory),
        backgroundColor: [
          '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc', '#ef5350', '#26a69a', '#d4e157', '#8d6e63'
        ],
      }]
    }, {
      plugins: { legend: { display: true, position: 'bottom' }, title: { display: true, text: 'Expenses by Category' } }
    });

    // Bar chart: Income vs Expense by category
    const allCats = Array.from(new Set([...Object.keys(expenseByCategory), ...Object.keys(incomeByCategory)]));
    const barImg = await createChart('bar', {
      labels: allCats,
      datasets: [
        {
          label: 'Income',
          data: allCats.map(cat => incomeByCategory[cat] || 0),
          backgroundColor: '#66bb6a'
        },
        {
          label: 'Expense',
          data: allCats.map(cat => expenseByCategory[cat] || 0),
          backgroundColor: '#ef5350'
        }
      ]
    }, {
      plugins: { legend: { display: true }, title: { display: true, text: 'Income vs Expense by Category' } },
      responsive: false,
      scales: { x: { stacked: true }, y: { beginAtZero: true } }
    });

    // Line chart: Daily expenses (compare with previous month)
    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const lineImg = await createChart('line', {
      labels: days.map(d => d.toString()),
      datasets: [
        {
          label: `${new Date(start).toLocaleString('default', { month: 'short' })} Expenses`,
          data: days.map(d => dailyTotals[d]?.expense || 0),
          borderColor: '#ef5350',
          backgroundColor: '#ef535033',
          fill: false,
          tension: 0.2
        },
        {
          label: `${new Date(prevStart).toLocaleString('default', { month: 'short' })} Expenses`,
          data: days.map(d => prevDailyTotals[d]?.expense || 0),
          borderColor: '#1976d2',
          backgroundColor: '#1976d233',
          fill: false,
          tension: 0.2
        }
      ]
    }, {
      plugins: { legend: { display: true }, title: { display: true, text: 'Daily Expenses Comparison' } },
      responsive: false,
      scales: { y: { beginAtZero: true } }
    });

    const userName = localStorage.getItem('userName') || 'User';

    // Prepare PDF
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    
    // Header with group name
    const groupName =
      selectedGroupId !== null
        ? getGroupName(selectedGroupId, accounts)
        : 'All Groups';

    doc.setFontSize(22);
    doc.setTextColor(33, 150, 243);
    doc.text('Monthly Expense & Income Report', 105, 17, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text(`${userName}`, 105, 24, { align: 'center' });

    // Add group name to the report
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Group: ${groupName}`,
      105,
      30,
      { align: 'center' }
    );


    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(
      `Month: ${start.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
      105,
      36,
      { align: 'center' }
    );



        // Previous Month Net Balance
    doc.setFontSize(10);
    doc.setTextColor(33, 150, 243);
    doc.text(
      `Previous Month Net: ₹${prevNetBalance.toFixed(2)}`,
      40,
      42,
      { align: 'center' }
    );

    // Draw header line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(14, 44, 196, 44);

    // Add 3 charts in one row (inside border)
    const chartWidth = 58;
    const chartHeight = 38;
    const marginLeft = 6;
    const gap = 10;

    // Adjust the Y position so all charts fit inside the border
    const chartsY = 49; // was 45

    // All charts in one row, all inside the border
    doc.addImage(pieImg, 'PNG', marginLeft, 45, chartWidth, 30);
    doc.addImage(barImg, 'PNG', marginLeft + chartWidth + gap, chartsY, chartWidth, chartHeight);
    doc.addImage(lineImg, 'PNG', marginLeft + 2 * (chartWidth + gap), chartsY, chartWidth, chartHeight);

    // Draw header line
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(14, 90, 196, 90);


    // Move y below the charts for the tables
    let y = chartsY + chartHeight + 10;

    // Table: Income
    const incomeRows: any[] = [];
    let totalIncome = 0;
    filtered.forEach(exp => {
      if (exp.type === 'income') {
        incomeRows.push([
          exp.category,
          exp.description || '',
          new Date(exp.date).toLocaleDateString(),
          exp.amount.toFixed(2)
        ]);
        totalIncome += exp.amount;
      }
    });
    if (incomeRows.length > 0) {
      doc.setFontSize(14);
      doc.text('Income', 14, y);
      y += 4;
      autoTable(doc, {
        head: [['Category', 'Description', 'Date', 'Amount']],
        body: incomeRows,
        startY: y + 2,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [102, 187, 106] }
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 14, y);
      y += 10;
    }

    // Table: Expenses
    const expenseRows: any[] = [];
    let totalExpense = 0;
    filtered.forEach(exp => {
      if (exp.type === 'expense') {
        expenseRows.push([
          exp.category,
          exp.description || '',
          new Date(exp.date).toLocaleDateString(),
          exp.amount.toFixed(2)
        ]);
        totalExpense += exp.amount;
      }
    });
    if (expenseRows.length > 0) {
      doc.setFontSize(14);
      doc.text('Expenses', 14, y);
      y += 4;
      autoTable(doc, {
        head: [['Category', 'Description', 'Date', 'Amount']],
        body: expenseRows,
        startY: y + 2,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [239, 83, 80] }
      });
      y = (doc as any).lastAutoTable.finalY + 8;
      doc.setFontSize(12);
      doc.setTextColor(255, 0, 0);
      doc.text(`Total Expenses: ₹${totalExpense.toFixed(2)}`, 14, y);
      y += 10;
    }


    // Calculate remaining net balance (previous month net + this month net)
    const thisMonthNet = totalIncome - totalExpense;
    const remainingNetBalance = prevNetBalance + thisMonthNet;

    // Remaining Net Balance
    if (showIncome) {
      doc.setFontSize(13);
      doc.setTextColor(33, 150, 243);
      doc.text(
        `Net Balance: ₹${remainingNetBalance.toFixed(2)}`,
        14,
        y + 10
      );
      doc.setTextColor(0, 0, 0);
    }

    // Save PDF
    const pdfOutput = doc.output('arraybuffer');
    const fileName = `ExpenseReport-${reportMonth}.pdf`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Filesystem.requestPermissions();
        const base64Data = btoa(
          new Uint8Array(pdfOutput)
            .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents, // or Directory.External for Downloads
          encoding: Encoding.BASE64,
        });
        toast.success(`PDF saved to device storage as ${fileName}`);
      } else {
        const blob = new Blob([pdfOutput], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`PDF downloaded as ${fileName}`);
      }
    } catch (err) {
      toast.error(`Failed to save PDF: ${err}`);
    }
  };

  useEffect(() => {
    db.accounts.toArray().then(accs => setAccounts(accs.map(a => ({ id: a.id!, name: a.name }))));
  }, []);

  return (
    <IonPage style={{ paddingTop: marginTop}}>


      <IonContent className="ion-padding" style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div
          style={{
            position: 'sticky',
            top: -60,
            zIndex: 10,
            display: 'block',
            background: '#fff',
            marginBottom: 16,
          }}
        >
          <IonSearchbar
            value={searchText}
            onIonChange={e => setSearchText(e.detail.value!)}
            onIonClear={() => setSearchText('')}
            debounce={300}
            placeholder="Search by description or category"
            style={{
              borderRadius: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
              background: "#fff",
              marginBottom: 8
            }}
            showClearButton="always"
            showCancelButton="focus"
          />

          <center><p className='reportText'>Generate Monthly PDF Report</p></center>
          <div style={{ margin: "0 auto", marginTop: -13, marginBottom: 3, display: "flex", gap: 0, alignItems: "center", justifyContent: "center" }}>


            <IonItem style={{ background: "#fff", flex: 1 }}>
              <IonSelect
                value={reportMonth.split('-')[0]}
                onIonChange={e => {
                  const [_, m] = reportMonth.split('-');
                  setReportMonth(`${e.detail.value}-${m}`);
                }}
                interface="popover"
                style={{ minWidth: 90 }}
              >
                {Array.from({ length: 10 }).map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  return (
                    <IonSelectOption key={year} value={year.toString()}>
                      {year}
                    </IonSelectOption>
                  );
                })}
              </IonSelect>
            </IonItem>
            <IonItem style={{ background: "#fff", flex: 1 }}>
              <IonSelect
                value={reportMonth.split('-')[1]}
                onIonChange={e => {
                  const [y, _] = reportMonth.split('-');
                  setReportMonth(`${y}-${e.detail.value}`);
                }}
                interface="popover"
                style={{ minWidth: 90 }}
              >
                {Array.from({ length: 12 }).map((_, i) => {
                  const month = String(i + 1).padStart(2, '0');
                  return (
                    <IonSelectOption key={month} value={month}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </IonSelectOption>
                  );
                })}
              </IonSelect>
            </IonItem>
            <IonButton color="primary" onClick={generateMonthlyPDFReport}>
              Download
            </IonButton>
          </div>






          <div style={{ borderBottom: '1px solid black' }}></div>

          <IonItem
            lines="none"
            className="ion-margin-bottom"
            style={{
              borderRadius: 12,
              background: "#fff",
              marginBottom: 0
            }}
          >
            <IonLabel>Category</IonLabel>
            <IonSelect
              value={selectedCategory}
              placeholder="All"
              onIonChange={e => setSelectedCategory(e.detail.value)}
              interface="popover"
            >
              <IonSelectOption value="">All</IonSelectOption>
              {categories.map(cat => (
                <IonSelectOption key={cat.id} value={cat.name}>
                  <IonIcon icon={cat.icon} style={{ color: cat.color, marginRight: 8 }} /> {cat.name}
                </IonSelectOption>
              ))}
            </IonSelect>

            <p>Total Expenses:
              <div style={{ fontSize: 18, color: "#e53935", fontWeight: 600 }}>
                ₹{totalFilteredExpenses.toFixed(2)}
              </div>
            </p>
          </IonItem>
          <div style={{ borderBottom: '3px solid gray' }}></div>
                  <div style={{ borderBottom: '15px solid white' }}></div>
        </div>

        {loading ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>Loading...</IonLabel>
          </div>
        ) : expenses.length === 0 ? (
          <div className="ion-text-center ion-padding">
            <IonLabel>No transactions recorded yet</IonLabel>
          </div>
        ) : (
          <IonList lines="none">
            {filteredExpenses.map(expense => {
              const cat = getCategory(expense.category);
              function confirmDeleteExpense(expense: Expense): void {
                setDeletingExpense(expense);
                setDeleteModalOpen(true);
              }
              return (
                <IonItem
                  key={expense.id}
                  style={{
                    borderRadius: 14,
                    marginBottom: 12,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
                    background: "#fff",
                    borderLeft: `6px solid ${cat?.color || "#ccc"}`,
                    transition: "box-shadow 0.2s",
                    alignItems: 'center',
                    minHeight: 64,
                    padding: 0
                  }}
                  className="expense-card"
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '5px 0'
                  }}>
                    <IonAvatar slot="start" style={{
                      background: cat?.color || "#eee",
                      marginLeft: -12,
                      marginRight: 12,
                      width: 30,
                      height: 30,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <IonIcon icon={cat?.icon} style={{ color: "#fff", fontSize: 24 }} />
                    </IonAvatar>
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%'
                      }}>
                        <span style={{
                          fontWeight: 600,
                          fontSize: 16,
                          color: "#222",
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '60%'
                        }}>
                          {expense.category}
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            padding: '4px 14px',
                            borderRadius: 6,
                            marginLeft: 8,
                            backgroundColor: expense.type === 'income'
                              ? 'var(--ion-color-success, #43a047)'
                              : 'var(--ion-color-danger, #e53935)',
                            color: '#fff',
                            minWidth: 90,
                            textAlign: 'right',
                            letterSpacing: 0.5
                          }}
                        >
                          {expense.type === 'income' ? '+' : '-'}₹{expense.amount.toFixed(2)}
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 2
                      }}>
                        <span style={{
                          color: "#666",
                          fontSize: 14,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70%'
                        }}>
                          {expense.description}
                        </span>
                        <IonNote style={{
                          fontSize: 12,
                          color: "#888",
                          marginLeft: 8,
                          minWidth: 60,
                          textAlign: 'right'
                        }}>
                          {new Date(expense.date).toLocaleDateString()}
                        </IonNote>
                      </div>
                    </div>
                    <IonButtons slot="end" style={{ marginLeft: 8, alignSelf: 'flex-start' }}>
                      <IonButton
                        color="medium"
                        onClick={() => openEditModal(expense)}
                        style={{ marginRight: 2 }}
                      >
                        <IonIcon icon={pencil} />
                      </IonButton>
                      <IonButton
                        color="danger"
                        onClick={() => confirmDeleteExpense(expense)}
                      >
                        <IonIcon icon={trash} />
                      </IonButton>
                    </IonButtons>
                  </div>
                </IonItem>
              );
            })}
          </IonList>
        )}
        {/* Edit Expense Modal (React Modal) */}
        <Modal
          isOpen={editModalOpen}
          onRequestClose={() => setEditModalOpen(false)}
          contentLabel="Edit Transaction"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1000,
              backdropFilter: 'blur(3px)'
            },
            content: {
              maxWidth: '95vw',
              width: '95vw',
              top: '40%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
              background: "linear-gradient(135deg, #f6f8fa 0%, #e3f2fd 100%)",
              borderRadius: 22,
              boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
              padding: 20,
              border: 'none',
              minHeight: 0,
              overflow: 'visible'
            }
          }}
        >
          <div style={{
            maxWidth: 420,
            margin: '0 auto',
            borderRadius: 18,
            background: 'var(--ion-background-color, #f6f8fa)'
          }}>
            <div style={{
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: 22,

              marginBottom: 18,
              color: '#1976d2',
              textAlign: 'center'
            }}>Edit Transaction</div>
            <form
              onSubmit={e => {
                e.preventDefault();
                handleEditSave();
              }}
              style={{ maxWidth: 400, margin: '0 auto' }}
            >
              <div style={{
                background: '#fff',
                padding: 8
              }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Amount</label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={e => setEditAmount(parseFloat(e.target.value) || 0)}
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Enter amount"
                  style={{ color: '#222', width: '100%', borderRadius: 8, border: '1.5px solid #90caf9', padding: '10px 8px', background: "#f6f8fa" }}
                />
              </div>
              <div style={{ background: '#fff', padding: 8 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
                <select
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 8px',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    fontWeight: 500,
                    background: "#f6f8fa",
                    fontSize: 16,
                    color: "#1976d2"
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ background: '#fff', padding: 10 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Add a note (optional)"
                  style={{
                    fontWeight: 500,
                    fontSize: 16,
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    background: "#f6f8fa",
                    color: "#1976d2",
                    resize: 'vertical'
                  }}
                />
              </div>
              <div style={{ background: '#fff', padding: 8 }}>
                <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Date</label>
                <input
                  type="date"
                  value={editDate.slice(0, 10)}
                  onChange={e => setEditDate(new Date(e.target.value).toISOString())}
                  style={{
                    width: '100%',
                    borderRadius: 8,
                    border: '1.5px solid #90caf9',
                    padding: '10px 8px',
                    fontSize: 16,
                    background: "#f6f8fa",
                    color: "#1976d2"
                  }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, marginBottom: 20, paddingBottom: 20 }}>
                <button
                  type="submit"
                  style={{
                    borderRadius: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontSize: 18,
                    width: '60%',
                    boxShadow: "0 2px 8px #1976d233",
                    background: "#1976d2",
                    color: "#fff",
                    border: 'none',
                    padding: '12px 0',
                    cursor: 'pointer'
                  }}
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  style={{
                    borderRadius: 20,
                    fontWeight: 700,
                    letterSpacing: 1,
                    fontSize: 18,
                    width: '30%',
                    background: "#e3f2fd",
                    color: "#1976d2",
                    border: 'none',
                    padding: '12px 0',
                    cursor: 'pointer'
                  }}
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={deleteModalOpen}
          onRequestClose={() => setDeleteModalOpen(false)}
          contentLabel="Confirm Delete"
          style={{
            overlay: {
              backgroundColor: 'rgba(25,118,210,0.13)',
              zIndex: 1100,
              backdropFilter: 'blur(3px)'
            },
            content: {
              maxWidth: 340,
              width: '90vw',
              top: '50%',
              left: '50%',
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 8px 36px 0 rgba(25, 118, 210, 0.18)",
              padding: 0,
              border: 'none',
              minHeight: 0,
              overflow: 'visible'
            }
          }}
        >
          <div style={{
            padding: 28,
            textAlign: 'center'
          }}>
            <h3 style={{ color: '#e53935', fontWeight: 700, marginBottom: 18 }}>
              Confirm Delete
            </h3>
            <p style={{ color: '#444', marginBottom: 24 }}>
              Are you sure you want to delete this transaction?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button
                onClick={handleDeleteExpense}
                style={{
                  background: '#e53935',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteModalOpen(false)}
                style={{
                  background: '#e3f2fd',
                  color: '#1976d2',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 28px',
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>

        <style>
          {`
            .expense-card:hover {
              box-shadow: 0 4px 24px rgba(0,0,0,0.13);
              transform: translateY(-2px);
            }
          `}
        </style>

      </IonContent>


    </IonPage>
  );
};

export default ExpenseList;