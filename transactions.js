window.app.loadTransactions = async function() {
  const container = document.getElementById('transactionList');
  if (!container) return;
  container.innerHTML = "<p style='color:#64748b; font-size:14px;'>Loading transactions...</p>";

  try {
    const userId = window.app.currentUser.uid;
    const depSnap = await db.collection("depositRequests").where("userId", "==", userId).get();
    const wdSnap = await db.collection("withdrawalRequests").where("userId", "==", userId).get();

    let records = [];

    depSnap.forEach(doc => {
      const d = doc.data();
      records.push({
        type: "Deposit",
        amount: d.amount,
        detail: d.mpesaCode ? `Code: ${d.mpesaCode}` : '',
        status: d.status || 'pending',
        date: d.createdAt ? d.createdAt.toDate() : new Date(0)
      });
    });

    wdSnap.forEach(doc => {
      const d = doc.data();
      records.push({
        type: "Withdrawal",
        amount: d.amount,
        detail: d.phone ? `Phone: ${d.phone}` : '',
        status: d.status || 'pending',
        date: d.createdAt ? d.createdAt.toDate() : new Date(0)
      });
    });

    if (records.length === 0) {
      container.innerHTML = "<p style='color:#64748b; font-size:14px;'>No transactions found.</p>";
      return;
    }

    records.sort((a, b) => b.date - a.date);

    let html = "";
    records.forEach(item => {
      let color = "#f39c12";
      let statusText = "⏳ PENDING";

      if (item.status === "approved") {
        color = "#27ae60";
        statusText = "✅ APPROVED";
      } else if (item.status === "rejected") {
        color = "#e74c3c";
        statusText = "❌ REJECTED";
      }

      html += `
        <div style="background:#1e293b; border:1px solid #334155; padding:12px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#ffffff;">${item.type === 'Deposit' ? '💵 Deposit' : '🏧 Withdrawal'}</strong>
            <span style="color:${color}; font-weight:bold; font-size:0.8rem;">${statusText}</span>
          </div>
          <div style="color:#f39c12; font-weight:bold; font-size:1.1rem; margin:4px 0;">KES ${item.amount.toLocaleString()}</div>
          <div style="color:#94a3b8; font-size:0.8rem; display:flex; justify-content:space-between;">
            <span>${item.detail}</span>
            <span>${item.date.toLocaleDateString()}</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>Error loading transactions.</p>";
  }
};
