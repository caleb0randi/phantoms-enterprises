/**
 * transactions.js - Transaction History Module
 * Dynamically adds a Transaction History menu item and full history view for users.
 */

(function () {
  const checkFirebase = setInterval(() => {
    if (window.firebase && firebase.apps.length > 0) {
      clearInterval(checkFirebase);
      initTransactionModule();
    }
  }, 300);

  function initTransactionModule() {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // 1. INJECT MENU ITEM INTO EXISTING NAV DRAWER
    const navDrawer = document.getElementById('navDrawer');
    if (navDrawer) {
      const historyMenuItem = document.createElement('div');
      historyMenuItem.className = 'menu-item';
      historyMenuItem.innerHTML = '📜 Transaction History';
      historyMenuItem.onclick = function () {
        openTransactionHistory();
      };
      
      // Insert before the last item (Sign Out)
      const signOutBtn = navDrawer.querySelector('.menu-item[style*="c0392b"]');
      if (signOutBtn) {
        navDrawer.insertBefore(historyMenuItem, signOutBtn);
      } else {
        navDrawer.appendChild(historyMenuItem);
      }
    }

    // 2. CREATE TRANSACTION HISTORY VIEW CONTAINER DYNAMICALLY
    const container = document.querySelector('.container');
    if (container) {
      const historyView = document.createElement('div');
      historyView.id = 'transactionHistoryView';
      historyView.className = 'app-view hidden';
      historyView.innerHTML = `
        <div class="dash-section">
          <div class="dash-section-title">📜 My Transaction History</div>
          <div id="transactionList" style="display: flex; flex-direction: column; gap: 12px; margin-top: 15px;">
            <p style="color:#64748b; font-size:14px;">Loading history...</p>
          </div>
        </div>
      `;
      container.appendChild(historyView);
    }

    // 3. OPEN AND RENDER TRANSACTION HISTORY
    window.openTransactionHistory = function () {
      if (!auth.currentUser) return;

      // Hide all current app views
      const views = document.querySelectorAll('.app-view');
      views.forEach(v => v.classList.add('hidden'));

      // Show Transaction History view & close drawer
      const txView = document.getElementById('transactionHistoryView');
      if (txView) txView.classList.remove('hidden');
      if (navDrawer) navDrawer.classList.remove('open');

      loadUserTransactions(auth.currentUser.uid);
    };

    // 4. FETCH DEPOSITS AND WITHDRAWALS LIVE
    function loadUserTransactions(userId) {
      const txContainer = document.getElementById('transactionList');
      if (!txContainer) return;

      txContainer.innerHTML = "<p style='color:#64748b;'>Syncing records...</p>";

      // Fetch Deposits
      const depositsPromise = db.collection("depositRequests")
        .where("userId", "==", userId)
        .get();

      // Fetch Withdrawals
      const withdrawalsPromise = db.collection("withdrawalRequests")
        .where("userId", "==", userId)
        .get();

      Promise.all([depositsPromise, withdrawalsPromise]).then(([depSnap, wdSnap]) => {
        let records = [];

        depSnap.forEach(doc => {
          const data = doc.data();
          records.push({
            type: "Deposit",
            amount: data.amount,
            codeOrPhone: data.mpesaCode ? `Code: ${data.mpesaCode}` : '',
            status: data.status || 'pending',
            date: data.createdAt ? data.createdAt.toDate() : new Date(0)
          });
        });

        wdSnap.forEach(doc => {
          const data = doc.data();
          records.push({
            type: "Withdrawal",
            amount: data.amount,
            codeOrPhone: data.phone ? `Phone: ${data.phone}` : '',
            status: data.status || 'pending',
            date: data.createdAt ? data.createdAt.toDate() : new Date(0)
          });
        });

        if (records.length === 0) {
          txContainer.innerHTML = "<p style='color:#64748b; font-size:14px;'>No transactions recorded yet.</p>";
          return;
        }

        // Sort by latest date
        records.sort((a, b) => b.date - a.date);

        let html = "";
        records.forEach(item => {
          let statusColor = "#f39c12"; // Pending - Orange
          let statusLabel = "⏳ PENDING APPROVAL";

          if (item.status === "approved") {
            statusColor = "#27ae60"; // Approved - Green
            statusLabel = item.type === "Deposit" ? "✅ APPROVED & CREDITED" : "✅ APPROVED & PAID";
          } else if (item.status === "rejected") {
            statusColor = "#e74c3c"; // Rejected - Red
            statusLabel = item.type === "Withdrawal" ? "❌ REJECTED & REFUNDED" : "❌ REJECTED";
          }

          const icon = item.type === "Deposit" ? "💵" : "🏧";

          html += `
            <div style="background:#1e293b; border:1px solid #334155; padding:12px; border-radius:8px;">
              <div style="display:flex; justify-between; align-items:center; margin-bottom:6px;">
                <strong style="color:#ffffff; font-size:0.95rem;">${icon} ${item.type}</strong>
                <span style="color:${statusColor}; font-weight:bold; font-size:0.8rem;">${statusLabel}</span>
              </div>
              <div style="color:#f39c12; font-weight:bold; font-size:1rem; margin-bottom:4px;">
                KES ${Number(item.amount).toLocaleString()}
              </div>
              <div style="color:#94a3b8; font-size:0.8rem; display:flex; justify-content:space-between;">
                <span>${item.codeOrPhone}</span>
                <span>${item.date.toLocaleDateString()} ${item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            </div>
          `;
        });

        txContainer.innerHTML = html;
      }).catch(err => {
        txContainer.innerHTML = "<p style='color:red;'>Failed to load transactions.</p>";
      });
    }
  }
})();
            
