// earnings.js - Dynamic standalone earnings section (DO NOT TOUCH index.html)

(function () {
  // Wait until Firebase and main app instance are fully ready
  const checkAppReady = setInterval(() => {
    if (window.app && window.db && window.auth) {
      clearInterval(checkAppReady);
      initEarningsModule();
    }
  }, 100);

  function initEarningsModule() {
    // -------------------------------------------------------------
    // 1. INJECT DEDICATED "earningsView" CONTAINER INTO BODY
    // -------------------------------------------------------------
    function injectEarningsView() {
      const container = document.querySelector(".container");
      if (!container || document.getElementById("earningsView")) return;

      const earningsView = document.createElement("div");
      earningsView.id = "earningsView";
      earningsView.className = "app-view hidden";
      earningsView.innerHTML = `
        <div class="dash-section">
          <div class="dash-section-title">💰 My Daily Earnings</div>
          <div style="background:#1e293b; color:#fff; padding:15px; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; color:#94a3b8;">Total Earnings Claimed:</span>
            <strong id="totalEarningsDisplay" style="font-size:18px; color:#27ae60;">KES 0.00</strong>
          </div>
          <div id="earningsPackageList">Loading investment return packages...</div>
        </div>
      `;

      container.appendChild(earningsView);
    }

    // -------------------------------------------------------------
    // 2. INJECT "MY EARNINGS" MENU ITEM RIGHT BELOW TRANSACTION HISTORY
    // -------------------------------------------------------------
    function injectMenuItem() {
      const navDrawer = document.getElementById("navDrawer");
      if (!navDrawer || document.getElementById("drawerEarningsBtn")) return;

      // Locate the Transaction History menu item
      const menuItems = navDrawer.querySelectorAll(".menu-item");
      let txItem = null;
      menuItems.forEach((item) => {
        if (item.innerText.includes("Transaction History")) {
          txItem = item;
        }
      });

      const earningsBtn = document.createElement("div");
      earningsBtn.id = "drawerEarningsBtn";
      earningsBtn.className = "menu-item";
      earningsBtn.innerHTML = "💰 My Earnings";
      earningsBtn.onclick = function () {
        app.switchView("earningsView");
      };

      if (txItem && txItem.nextSibling) {
        navDrawer.insertBefore(earningsBtn, txItem.nextSibling);
      } else {
        navDrawer.appendChild(earningsBtn);
      }
    }

    // Initialize HTML DOM injections
    injectEarningsView();
    injectMenuItem();

    // -------------------------------------------------------------
    // 3. ATTACH loadEarnings TO WINDOW.APP
    // -------------------------------------------------------------
    window.app.loadEarnings = async function () {
      if (!app.currentUser) return;

      // Update total earnings display
      const totalDisplay = document.getElementById("totalEarningsDisplay");
      if (totalDisplay) {
        const total = app.userData ? app.userData.totalEarnings || 0 : 0;
        totalDisplay.innerText = "KES " + total.toLocaleString();
      }

      const listContainer = document.getElementById("earningsPackageList");
      if (!listContainer) return;

      listContainer.innerHTML = "Loading earnings data...";

      try {
        const snapshot = await db
          .collection("userInvestments")
          .where("userId", "==", app.currentUser.uid)
          .get();

        if (snapshot.empty) {
          listContainer.innerHTML =
            "<p style='color:#64748b; font-size:14px;'>No active packages found. Rent a package to start claiming daily earnings.</p>";
          return;
        }

        const todayStr = new Date().toISOString().split("T")[0];
        let cardsHtml = "<div style='display:flex; flex-direction:column; gap:10px;'>";

        snapshot.forEach((doc) => {
          const item = doc.data();
          const docId = doc.id;
          const dailyRate = calculateDailyProfit(item.packageName, item.cost);
          const alreadyClaimed = item.lastClaimedDate === todayStr;

          cardsHtml += `
            <div style="background:#f8fafc; border:1px solid #e2e8f0; padding:12px; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:#1a2b4c;">${item.packageName}</strong><br>
                <span style="font-size:12px; color:#64748b;">Daily Profit: KES ${dailyRate.toLocaleString()}</span>
              </div>
              <div>
                ${
                  alreadyClaimed
                    ? `<button disabled style="background:#cbd5e1; color:#64748b; border:none; padding:6px 12px; border-radius:4px; font-size:12px; cursor:not-allowed;">Claimed Today</button>`
                    : `<button onclick="app.claimDailyEarning('${docId}',${dailyRate})" style="background:#27ae60; color:#fff; border:none; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer;">Claim KES ${dailyRate}</button>`
                }
              </div>
            </div>
          `;
        });

        cardsHtml += "</div>";
        listContainer.innerHTML = cardsHtml;
      } catch (err) {
        listContainer.innerHTML =
          "<p style='color:#e74c3c; font-size:13px;'>Error loading packages: " + err.message + "</p>";
      }
    };

    // Hook loadEarnings into switchView when opening earningsView
    const originalSwitchView = window.app.switchView;
    window.app.switchView = function (viewId) {
      if (originalSwitchView) originalSwitchView(viewId);
      if (viewId === "earningsView") {
        app.loadEarnings();
      }
    };

    // Ensure injection occurs whenever UI updates
    const originalUpdateUI = window.app.updateUI;
    window.app.updateUI = function () {
      if (originalUpdateUI) originalUpdateUI();
      injectEarningsView();
      injectMenuItem();
    };

    // -------------------------------------------------------------
    // 4. CLAIM DAILY EARNING LOGIC
    // -------------------------------------------------------------
    window.app.claimDailyEarning = async function (docId, rate) {
      if (!app.currentUser) return;

      const todayStr = new Date().toISOString().split("T")[0];

      try {
        await db.collection("userInvestments").doc(docId).update({
          lastClaimedDate: todayStr,
        });

        const newBalance = (app.userData.balance || 0) + rate;
        const newTotal = (app.userData.totalEarnings || 0) + rate;

        await db.collection("users").doc(app.currentUser.uid).update({
          balance: newBalance,
          totalEarnings: newTotal,
        });

        await db.collection("transactions").add({
          userId: app.currentUser.uid,
          type: "Daily Earning Claim",
          amount: rate,
          createdAt: new Date(),
        });

        app.userData.balance = newBalance;
        app.userData.totalEarnings = newTotal;
        app.updateUI();
        app.showAlert("Successfully claimed KES " + rate + "!");

        app.loadEarnings();
      } catch (err) {
        app.showAlert("Failed to claim: " + err.message, true);
      }
    };

    function calculateDailyProfit(packageName, cost) {
      if (cost === 1000) return 150;
      if (cost === 3000) return 500;
      if (cost === 10000) return 1800;
      return Math.round(cost * 0.15);
    }
  }
})();
          
