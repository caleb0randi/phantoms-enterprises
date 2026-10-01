// earnings.js - Fully standalone file (DO NOT touch index.html)

(function () {
  // Wait for the main app to load
  const checkAppReady = setInterval(() => {
    if (window.app && window.db && window.auth) {
      clearInterval(checkAppReady);
      initEarningsModule();
    }
  }, 100);

  function initEarningsModule() {
    // 1. Attach loadEarnings function to the global app object
    window.app.loadEarnings = async function () {
      if (!app.currentUser) return;

      const userDoc = await db.collection("users").doc(app.currentUser.uid).get();
      if (!userDoc.exists) return;

      const userData = userDoc.data();
      const totalEarnings = userData.totalEarnings || 0;

      // Update total earnings display if element exists
      const totalDisplay = document.getElementById("totalEarningsDisplay");
      if (totalDisplay) {
        totalDisplay.innerText = "KES " + totalEarnings.toLocaleString();
      }

      // Fetch active user packages
      const container = document.getElementById("earningsPackageList");
      if (!container) return;

      container.innerHTML = "Loading earnings data...";

      try {
        const snapshot = await db
          .collection("userInvestments")
          .where("userId", "==", app.currentUser.uid)
          .get();

        if (snapshot.empty) {
          container.innerHTML =
            "<p style='color:#64748b; font-size:14px;'>No active packages to claim daily earnings from.</p>";
          return;
        }

        const todayStr = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
        let html = "<div style='display:flex; flex-direction:column; gap:12px;'>";

        snapshot.forEach((doc) => {
          const item = doc.data();
          const docId = doc.id;
          const dailyRate = calculateDailyProfit(item.packageName, item.cost);
          const alreadyClaimed = item.lastClaimedDate === todayStr;

          html += `
            <div style="background:#1e293b; border:1px solid #334155; padding:14px; border-radius:8px; color:#fff;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="font-size:16px; color:#f39c12;">${item.packageName}</strong><br>
                  <span style="font-size:13px; color:#94a3b8;">Daily Return: KES ${dailyRate.toLocaleString()} / day</span>
                </div>
                <div>
                  ${
                    alreadyClaimed
                      ? `<button disabled style="background:#475569; color:#94a3b8; border:none; padding:8px 12px; border-radius:5px; cursor:not-allowed;">Claimed Today</button>`
                      : `<button onclick="app.claimDailyEarning('${docId}',${dailyRate})" style="background:#27ae60; color:#fff; border:none; padding:8px 14px; border-radius:5px; cursor:pointer; font-weight:bold;">Claim KES ${dailyRate}</button>`
                  }
                </div>
              </div>
            </div>
          `;
        });

        html += "</div>";
        container.innerHTML = html;
      } catch (err) {
        container.innerHTML =
          "<p style='color:#e74c3c;'>Error loading earnings: " + err.message + "</p>";
      }
    };

    // 2. Add claim function to window.app
    window.app.claimDailyEarning = async function (docId, rate) {
      if (!app.currentUser) return;

      const todayStr = new Date().toISOString().split("T")[0];

      try {
        // Update user investment last claimed date
        await db.collection("userInvestments").doc(docId).update({
          lastClaimedDate: todayStr,
        });

        // Update user balance and total earnings
        const newBalance = (app.userData.balance || 0) + rate;
        const newTotal = (app.userData.totalEarnings || 0) + rate;

        await db.collection("users").doc(app.currentUser.uid).update({
          balance: newBalance,
          totalEarnings: newTotal,
        });

        // Log transaction history entry automatically
        await db.collection("transactions").add({
          userId: app.currentUser.uid,
          type: "Daily Earning Claim",
          amount: rate,
          createdAt: new Date(),
        });

        // Update local state and UI
        app.userData.balance = newBalance;
        app.userData.totalEarnings = newTotal;
        app.updateUI();
        app.showAlert("Successfully claimed KES " + rate + "!");

        // Refresh earnings list
        app.loadEarnings();
      } catch (err) {
        app.showAlert("Failed to claim earning: " + err.message, true);
      }
    };

    // Helper: calculate profits based on package cost
    function calculateDailyProfit(packageName, cost) {
      if (cost === 1000) return 150;
      if (cost === 3000) return 500;
      if (cost === 10000) return 1800;
      return Math.round(cost * 0.15); // Fallback: 15% daily profit
    }
  }
})();
