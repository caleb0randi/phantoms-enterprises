/**
 * sync.js - Real-time Data Synchronization Bridge
 * Connects Admin updates directly to the User Interface live in Firebase Firestore.
 */

(function () {
  // Wait until Firebase is ready
  const checkFirebase = setInterval(() => {
    if (window.firebase && firebase.apps.length > 0) {
      clearInterval(checkFirebase);
      initSyncBridge();
    }
  }, 300);

  function initSyncBridge() {
    const db = firebase.firestore();
    const auth = firebase.auth();

    // 1. REAL-TIME INVESTMENT PACKAGES SYNC
    // Listens for new packages or deletions made in admin.html
    const investmentContainer = document.querySelector('#investmentsView .rental-grid');
    if (investmentContainer) {
      db.collection("investmentPackages").onSnapshot((snapshot) => {
        // If admin has defined dynamic packages, replace hardcoded cards
        if (!snapshot.empty) {
          let html = "";
          snapshot.forEach((doc) => {
            const pkg = doc.data();
            const imgHtml = pkg.imgUrl 
              ? `<img src="${pkg.imgUrl}" style="width:100%; height:120px; object-fit:cover; border-radius:6px; margin-bottom:10px;" alt="${pkg.name}">` 
              : '';

            html += `
              <div class="rental-card" style="background:#1e293b; border:1px solid #334155; padding:15px; border-radius:8px; margin-bottom:15px;">
                ${imgHtml}
                <h4 style="color:#ffffff; font-size:1.1rem; margin-bottom:5px;">${pkg.name}</h4>
                <div class="rental-price" style="color:#f39c12; font-weight:bold; margin-bottom:5px;">KES ${Number(pkg.price).toLocaleString()}</div>
                <div class="rental-detail" style="color:#94a3b8; font-size:0.85rem; margin-bottom:12px;">
                  Daily Profit: <strong style="color:#27ae60;">KES ${Number(pkg.dailyProfit).toLocaleString()} / day</strong>
                </div>
                <button type="button" class="rent-btn" style="width:100%; padding:10px; background:#27ae60; color:white; border:none; border-radius:5px; font-weight:bold; cursor:pointer;" onclick="app.rentPlan('${pkg.name}', ${pkg.price})">Rent Package</button>
              </div>
            `;
          });
          investmentContainer.innerHTML = html;
        }
      });
    }

    // 2. REAL-TIME USER ACCOUNT & STATUS SYNC
    // Listens for balance updates, approvals, or account suspensions made in admin.html
    auth.onAuthStateChanged((user) => {
      if (user) {
        db.collection("users").doc(user.uid).onSnapshot((doc) => {
          if (doc.exists) {
            const data = doc.data();

            // Check if Admin suspended this account
            if (data.status === "suspended") {
              alert("Your account has been suspended by the administrator for violating terms.");
              auth.signOut();
              return;
            }

            // Sync balance and active investments to User Dashboard in real time
            if (window.app) {
              window.app.userData = data;
              if (typeof window.app.updateUI === "function") {
                window.app.updateUI();
              }
            }
          }
        });
      }
    });
  }
})();
