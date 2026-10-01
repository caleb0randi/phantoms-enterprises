// transactions.js - Complete setup for Earnings and Transactions (DO NOT TOUCH index.html)

(function () {
  // Run setup continuously until window.app, db, and auth are ready
  const checkAppReady = setInterval(() => {
    if (window.app && window.db && window.auth) {
      clearInterval(checkAppReady);
      initEarningsModule();
    }
  }, 100);

  function initEarningsModule() {
    // -------------------------------------------------------------
    // 1. INJECT THE EARNINGS VIEW INTO THE APP CONTAINER
    // -------------------------------------------------------------
    function createEarningsView() {
      if (document.getElementById("earningsView")) return;

      const container = document.querySelector(".container") || document.body;
      const earningsView = document.createElement("div");
      earningsView.id = "earningsView";
      earningsView.className = "app-view hidden";
      earningsView.innerHTML = `
        <div class="dash-section" style="padding:15px;">
          <div class="dash-section-title" style="font-size:18px; font-weight:bold; margin-bottom:15px; color:#1e293b;">💰 My Daily Earnings</div>
          
          <div style="background:#1e293b; color:#fff; padding:15px; border-radius:8px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px; color:#94a3b8;">Total Earnings Claimed:</span>
            <strong id="totalEarningsDisplay" style="font-size:18px; color:#27ae60;">KES 0.00</strong>
          </div>

          <div id="earningsPackageList" style="margin-top:15px;">Loading active packages...</div>
        </div>
      `;

      container.appendChild(earningsView);
    }

    // -------------------------------------------------------------
    // 2. INJECT "MY EARNINGS" BUTTON INTO SIDE NAV MENU
    // -------------------------------------------------------------
    function createMenuItem() {
      if (document.getElementById("drawerEarningsBtn")) return;

      const navDrawer = document.getElementById("navDrawer");
      if (!navDrawer) return;

      const earningsBtn = document.createElement("div");
      earningsBtn.id = "drawerEarningsBtn";
      earningsBtn.className = "menu-item";
      earningsBtn.style.cursor = "pointer";
      earningsBtn.innerHTML = "💰 My Earnings";
      
      earningsBtn.onclick = function () {
        app.switchView("earningsView");
        // Close menu drawer if toggle function exists
        if (typeof toggleDrawer === "function") toggleDrawer();
      };

      // Find 'Transaction History' or 'Profile' to insert next to it
      const menuItems = navDrawer.querySelectorAll(".menu-item");
      let inserted = false;

      menuItems.forEach((item) => {
        if (item.innerText.includes("Transaction History") || item.innerText.includes("Profile")) {
          navDrawer.insertBefore(earningsBtn, item.nextSibling);
          inserted = true;
        }
      });

      if (!inserted) {
        navDrawer.appendChild(earningsBtn);
      }
    }

    // Run injections immediately
    createEarningsView();
    createMenuItem();

    // -------------------------------------------------------------
    // 3. LOAD EARNINGS & PACKAGES DATA
    // -------------------------------------------------------------
    window.app.loadEarnings = async function () {
      if (!app.currentUser) return;

      // Update total claimed amount
      const totalDisplay = document.getElementById("totalEarningsDisplay");
      if (totalDisplay) {
        const total = app.userData ? app.userData.totalEarnings || 0 : 0;
        totalDisplay.innerText = "KES " + total.toLocaleString();
      }

      const listContainer = document.getElementById("earningsPackageList");
      if (!listContainer) return;

      listContainer.innerHTML = "<p style='color:#64748b; font-size:14px;'>Loading packages...</p>";

      try {
        const snapshot = await db
          .collection("userInvestments")
          .where("userId", "==", app.currentUser.uid)
          .get();

        if (snapshot.empty) {
          listContainer.innerHTML =
            "<p style='color:#64748b; font-size:14px;'>No active packages found. Rent a package to start earning daily returns.</p>";
          return;
        }

        const todayStr = new Date().toISOString().split("T")[0];
        let html = "<div style='display:flex; flex-direction:column; gap:12px;'>";

        snapshot.forEach((doc) => {
          const item = doc.data();
          const docId = doc.id;
          const dailyRate = calculateDailyProfit(item.packageName, item.cost);
          const alreadyClaimed = item.lastClaimedDate === todayStr;

          html += `
            <div style="background:#ffffff; border:1px solid #e2e8f0; padding:14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
              <div>
                <strong style="color:#1e293b; font-size:15px;">${item.packageName || "Investment Package"}</strong><br>
                <span style="font-size:13px; color:#64748b;">Daily Return: KES ${dailyRate.toLocaleString()}</span>
              </div>
              <div>
                ${
                  alreadyClaimed
                    ? `<button disabled style="background:#cbd5e1; color:#64748b; border:none; padding:8px 12px; border-radius:6px; font-size:12px; cursor:not-allowed;">Claimed Today</button>`
                    : `<button onclick="app.claimDailyEarning('${docId}',${dailyRate})" style="background:#27ae60; color:#fff; border:none; padding:8px 14px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">Claim KES ${dailyRate}</button>`
                }
              </div>
            </div>
          `;
        });

        html += "</div>";
        listContainer.innerHTML = html;
      } catch (err) {
        listContainer.innerHTML =
          "<p style='color:#e74c3c; font-size:13px;'>Error loading packages: " + err.message + "</p>";
      }
    };

    // -------------------------------------------------------------
    // 4. CLAIM DAILY EARNING FUNCTION
    // -------------------------------------------------------------
    window.app.claimDailyEarning = async function (docId, rate) {
      if (!app.currentUser) return;

      const todayStr = new Date().toISOString().split("T")[0];

      try {
        // Update package claimed date
        await db.collection("userInvestments").doc(docId).update({
          lastClaimedDate: todayStr,
        });

        // Update user account balance and earnings total
        const currentBalance = app.userData ? app.userData.balance || 0 : 0;
        const currentTotal = app.userData ? app.userData.totalEarnings || 0 : 0;

        const newBalance = currentBalance + rate;
        const newTotal = currentTotal + rate;

        await db.collection("users").doc(app.currentUser.uid).update({
          balance: newBalance,
          totalEarnings: newTotal,
        });

        // Log transaction history
        await db.collection("transactions").add({
          userId: app.currentUser.uid,
          type: "Daily Earning Claim",
          amount: rate,
          createdAt: new Date(),
        });

        // Refresh UI state
        if (app.userData) {
          app.userData.balance = newBalance;
          app.userData.totalEarnings = newTotal;
        }

        if (typeof app.updateUI === "function") app.updateUI();
        if (typeof app.showAlert === "function") {
          app.showAlert("Successfully claimed KES " + rate + "!");
        } else {
          alert("Successfully claimed KES " + rate + "!");
        }

        app.loadEarnings();
      } catch (err) {
        if (typeof app.showAlert === "function") {
          app.showAlert("Failed to claim: " + err.message, true);
        } else {
          alert("Failed to claim: " + err.message);
        }
      }
    };

    // Helper profit calculator
    function calculateDailyProfit(packageName, cost) {
      if (cost === 1000) return 150;
      if (cost === 3000) return 500;
      if (cost === 10000) return 1800;
      return Math.round((cost || 0) * 0.15);
    }

    // -------------------------------------------------------------
    // 5. OVERRIDE switchView & updateUI TO GUARANTEE DISPLAY
    // -------------------------------------------------------------
    const origSwitch = window.app.switchView;
    window.app.switchView = function (viewId) {
      // Hide all existing view sections
      document.querySelectorAll(".app-view").forEach((el) => el.classList.add("hidden"));

      if (viewId === "earningsView") {
        const earningsEl = document.getElementById("earningsView");
        if (earningsEl) {
          earningsEl.classList.remove("hidden");
          app.loadEarnings();
        }
      } else if (origSwitch) {
        origSwitch(viewId);
      }
    };

    const origUpdate = window.app.updateUI;
    window.app.updateUI = function () {
      if (origUpdate) origUpdate();
      createEarningsView();
      createMenuItem();
    };
  }
})();
