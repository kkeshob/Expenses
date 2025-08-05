import React, { useState, useEffect } from 'react';
import {
  IonList,
  IonItem,
  IonLabel,
  IonNote,
  IonIcon,
  IonButtons,
  IonButton,
  IonContent,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonAvatar,
} from '@ionic/react';
import { trash, pencil } from 'ionicons/icons';
import { db, Expense, Category } from '../db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import Chart from 'chart.js/auto';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Modal from 'react-modal';

interface ExpenseListProps {
  selectedGroupId: number | null;
  marginTop: number;
}

const ExpenseList: React.FC<ExpenseListProps> = ({ selectedGroupId, marginTop }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDate, setEditDate] = useState<string>(new Date().toISOString());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [reportMonth, setReportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const showIncome = localStorage.getItem('show_income') === null
    ? true
    : localStorage.getItem('show_income') === 'true';

  useEffect(() => {
    db.categories.toArray().then(setCategories);
    db.accounts.toArray().then(accs => setAccounts(accs.map(a => ({ id: a.id!, name: a.name }))));
  }, []);

  const getCategory = (name: string) => categories.find(cat => cat.name === name);

  const loadExpenses = async () => {
    setLoading(true);
    try {
      let allExpenses: Expense[] = [];
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

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line
  }, [searchText, selectedCategory, selectedGroupId]);

  useEffect(() => {
    const handler = () => loadExpenses();
    db.on('changes', handler);
    return () => db.on('changes').unsubscribe(handler);
    // eslint-disable-next-line
  }, []);

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
      await loadExpenses();
    } catch (error) {
      toast.error(`Error updating transaction: ${error}`);
    }
  };

  const handleDeleteExpense = async () => {
    if (deletingExpense && deletingExpense.id !== undefined) {
      try {
        await db.expenses.delete(deletingExpense.id);
        setExpenses(expenses.filter(exp => exp.id !== deletingExpense.id));
        toast.success('Transaction deleted successfully');
      } catch (error) {
        toast.error(`Error deleting transaction: ${error}`);
      }
      setDeleteModalOpen(false);
      setDeletingExpense(null);
      await loadExpenses();
    }
  };

  const handleRefresh = (event: CustomEvent) => {
    loadExpenses().then(() => {
      event.detail.complete();
    });
  };

  // Helper to get start and end of selected month
  const getMonthRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  };

  // Filtered expenses: only selected month and selected group
  const filteredExpenses = expenses.filter(exp => {
    const groupMatch = selectedGroupId === null || exp.groupId === selectedGroupId;
    const { start, end } = getMonthRange(reportMonth);
    const expDate = new Date(exp.date);
    const monthMatch = expDate >= start && expDate <= end;
    const categoryMatch =
      selectedCategories.length === 0 ||
      selectedCategories.includes(exp.category);
    const searchMatch =
      !searchText ||
      (exp.description && exp.description.toLowerCase().includes(searchText.toLowerCase())) ||
      (exp.category && exp.category.toLowerCase().includes(searchText.toLowerCase()));
    const incomeMatch = showIncome || exp.type !== 'income';
    return groupMatch && monthMatch && categoryMatch && searchMatch && incomeMatch;
  });

  const totalFilteredExpenses = filteredExpenses
    .filter(exp => exp.type === 'expense')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const getGroupName = (groupId: number | null | undefined, accounts: { id: number; name: string }[]) => {
    if (!groupId) return '';
    const group = accounts.find(acc => acc.id === groupId);
    return group ? group.name : '';
  };

  // PDF Report Generation
  const generateMonthlyPDFReport = async () => {
    const [year, month] = reportMonth.split('-').map(Number);
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Previous month range
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevStart = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
    const prevEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);

    // Get all expenses for the selected group
    let allExpenses: Expense[] = [];
    if (selectedGroupId !== null) {
      allExpenses = await db.expenses.where('groupId').equals(selectedGroupId).toArray();
    } else {
      allExpenses = await db.expenses.toArray();
    }

    // Filter for current and previous month
    const filtered = allExpenses.filter(exp => {
      const date = new Date(exp.date);
      return date >= start && date <= end;
    });
    const prevFiltered = allExpenses.filter(exp => {
      const date = new Date(exp.date);
      return date >= prevStart && date <= prevEnd;
    });

    // Calculate previous month net
    const prevIncome = prevFiltered.filter(exp => exp.type === 'income').reduce((sum, exp) => sum + exp.amount, 0);
    const prevExpense = prevFiltered.filter(exp => exp.type === 'expense').reduce((sum, exp) => sum + exp.amount, 0);
   // const openingBalance = prevIncome - prevExpense; // Opening balance for this month

    // Calculate opening balance as sum of all previous transactions
    const openingBalance = allExpenses
      .filter(exp => new Date(exp.date) < start)
      .reduce((sum, exp) => {
        if (exp.type === 'income') return sum + exp.amount;
        if (exp.type === 'expense') return sum - exp.amount;
        return sum;
      }, 0);

    // Calculate this month net
    const totalIncome = filtered.filter(exp => exp.type === 'income').reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpense = filtered.filter(exp => exp.type === 'expense').reduce((sum, exp) => sum + exp.amount, 0);
    const thisMonthNet = totalIncome - totalExpense;

    // Closing balance for this month
    const closingBalance = openingBalance + thisMonthNet;

    // Net balance (opening + this month)
    const netBalance = openingBalance + thisMonthNet;

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
    const groupName =
      selectedGroupId !== null
        ? getGroupName(selectedGroupId, accounts)
        : 'All Groups';

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFontSize(22);
    doc.setTextColor(33, 150, 243);
    doc.text('Monthly Expense & Income Report', 105, 17, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(80, 80, 80);
    doc.text(`${userName}`, 105, 24, { align: 'center' });

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

    doc.setFontSize(10);
    doc.setTextColor(33, 150, 243);
    doc.text(
      `Opening Balance: ₹${openingBalance.toFixed(2)}`,
      40,
      42,
      { align: 'center' }
    );

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(14, 44, 196, 44);

    const chartWidth = 58;
    const chartHeight = 38;
    const marginLeft = 6;
    const gap = 10;
    const chartsY = 49;

    doc.addImage(pieImg, 'PNG', marginLeft, 45, chartWidth, 30);
    doc.addImage(barImg, 'PNG', marginLeft + chartWidth + gap, chartsY, chartWidth, chartHeight);
    doc.addImage(lineImg, 'PNG', marginLeft + 2 * (chartWidth + gap), chartsY, chartWidth, chartHeight);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.6);
    doc.line(14, 90, 196, 90);

    let y = chartsY + chartHeight + 10;

    // Table: Income
    const incomeRows: any[] = [];
    let totalIncomeTable = 0;
    filtered.forEach(exp => {
      if (exp.type === 'income') {
        incomeRows.push([
          exp.category,
          exp.description || '',
          new Date(exp.date).toLocaleDateString(),
          exp.amount.toFixed(2)
        ]);
        totalIncomeTable += exp.amount;
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
      doc.text(`Total Income: ₹${totalIncomeTable.toFixed(2)}`, 14, y);
      y += 10;
    }

    // Table: Expenses
    const expenseRows: any[] = [];
    let totalExpenseTable = 0;
    filtered.forEach(exp => {
      if (exp.type === 'expense') {
        expenseRows.push([
          exp.category,
          exp.description || '',
          new Date(exp.date).toLocaleDateString(),
          exp.amount.toFixed(2)
        ]);
        totalExpenseTable += exp.amount;
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
      doc.text(`Total Expenses: ₹${totalExpenseTable.toFixed(2)}`, 14, y);
      y += 10;
    }

    // Summarize all expenses by category for the selected month
    const summaryRows = Object.entries(expenseByCategory)
      .map(([cat, amount]) => [cat, `₹${amount.toFixed(2)}`]);

    if (summaryRows.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(44, 62, 80);
      doc.text('Expense Summary by Category', 14, y);
      y += 4;
      autoTable(doc, {
        head: [['Category', 'Total']],
        body: summaryRows,
        startY: y + 2,
        theme: 'striped',
        styles: { fontSize: 10, cellPadding: 2 },
        headStyles: { fillColor: [66, 165, 245] }
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }

    // Remaining Net Balance
    if (showIncome) {
      doc.setFontSize(13);
      doc.setTextColor(33, 150, 243);
      doc.text(
        `Closing Balance: ₹${closingBalance.toFixed(2)}`,
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
          directory: Directory.Documents,
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

  // Group filteredExpenses by day (date string)
  const expensesByDay: { [day: string]: Expense[] } = {};
  filteredExpenses.forEach(exp => {
    const dayStr = new Date(exp.date).toLocaleDateString();
    if (!expensesByDay[dayStr]) expensesByDay[dayStr] = [];
    expensesByDay[dayStr].push(exp);
  });
  // Sort days descending (latest first)
  const sortedDays = Object.keys(expensesByDay).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  return (
    <IonPage style={{ paddingTop: marginTop }}>
      <IonContent className="ion-padding" style={{ background: "#f6f8fa" }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{
          position: 'sticky',
          top: -60,
          zIndex: 10,
          display: 'block',
          background: '#fff',
          marginBottom: 16,
        }}>
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
            <div className="wrapHalf">
              <IonLabel>Category</IonLabel>
              <IonSelect
                value={selectedCategories}
                multiple
                placeholder="All"
                onIonChange={e => {
                  const value = e.detail.value as string[];
                  if (value.includes("")) {
                    // If "All" is selected, select all categories
                    if (selectedCategories.length !== categories.length) {
                      setSelectedCategories(['', ...categories.map(cat => cat.name)]);
                    } else {
                      // If already all selected, deselect all
                      setSelectedCategories([]);
                    }
                  } else {
                    setSelectedCategories(value);
                  }
                }}
                interface="popover"
              >
                <IonSelectOption value="">All</IonSelectOption>
                {categories.map(cat => (
                  <IonSelectOption key={cat.id} value={cat.name}>
                    <IonIcon style={{ color: cat.color, marginRight: 8 }} /> {cat.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </div>
            <div className="wrapHalf">
              <span>Total Expenses:</span>
              <div style={{ fontSize: 18, color: "#e53935", fontWeight: 600 }}>
                ₹{totalFilteredExpenses.toFixed(2)}
              </div>
            </div>
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
            {sortedDays.map(day => {
              const dayExpenses = expensesByDay[day];
              const dayTotal = dayExpenses
                .filter(exp => exp.type === 'expense')
                .reduce((sum, exp) => sum + exp.amount, 0);

              return (
                <React.Fragment key={day}>
                  <div style={{
                    background: "#e3f2fd",
                    padding: "8px 16px",
                    borderRadius: 8,
                    margin: "16px 0 8px 0",
                    fontWeight: 700,
                    color: "#1976d2",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <span>{day}</span>
                    <span>
                      Total: ₹{dayTotal.toFixed(2)}
                    </span>
                  </div>
                  {dayExpenses.map(expense => {
                    if (!showIncome && expense.type === 'income') return null;
                    const cat = getCategory(expense.category);
                    const confirmDeleteExpense = (expense: Expense) => {
                      setDeletingExpense(expense);
                      setDeleteModalOpen(true);
                    };
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
                          minHeight: 'auto',
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

                                maxWidth: '60%'
                              }}>
                                {expense.category}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
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
                              onClick={() => {
                                setEditingExpense(expense);
                                setEditAmount(expense.amount);
                                setEditDescription(expense.description ?? '');
                                setEditCategory(expense.category);
                                setEditDate(
                                  typeof expense.date === 'string'
                                    ? expense.date
                                    : new Date(expense.date).toISOString()
                                );
                                setEditModalOpen(true);
                              }}
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
                </React.Fragment>
              );
            })}
            <div className='extraSpace'></div>
          </IonList>
        )}

        {/* Edit Expense Modal */}
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