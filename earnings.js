window.app.loadEarnings = async function() {
  const earningsList = document.getElementById('earningsPackageList');
  const totalEarningsEl = document.getElementById('totalEarningsDisplay');
  const todayEarningsEl = document.getElementById('todayEarningsDisplay');

  if (!earningsList) return;
  earningsList.innerHTML = "<p style='color:#64748b; font-size:14px;'>Loading rental packages...</p>";

  try {
    const userId = window.app.currentUser.uid;

    // Fetch user profile for total earnings
    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const totalEarnings = userData.totalEarnings || 0;
    totalEarningsEl.innerText = `KES ${totalEarnings.toLocaleString()}`;

    // Map plan daily profit rates
    const profit Rates = {
      'Phantom Rig Alpha': 150,
      'Phantom Rig Pro': 500,
      'Phantom Enterprise Stack': 1800
    };

    // Fetch user investments
    const snapshot = await db.collection("userInvestments")
      .where("userId", "==", userId)
      .get();

    if (snapshot.empty) {
      earningsList.innerHTML = "<p style='color:#64748b; font-size:14px;'>You have no active rental packages. Rent a package first to start earning.</p>";
      todayEarningsEl.innerText = "KES 0.00";
      return;
    }

    let todayPotential = 0;
    let html = "";
    const todayStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      const dailyProfit = profitRates[data.packageName] || 150;
      todayPotential += dailyProfit;

      const lastClaimed = data.lastClaimedDate || "";
      const isClaimedToday = lastClaimed === todayStr;

      html += `
        <div style="background:#1e293b; border:1px solid #334155; padding:15px; border-radius:8px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#ffffff; font-size:1rem;">⚡ ${data.packageName}</strong>
            <span style="color:#27ae60; font-weight:bold; font-size:0.9rem;">+KES ${dailyProfit}/day</span>
          </div>
          <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94a3b8; font-size:0.8rem;">Status: ${isClaimedToday ? '✅ Claimed Today' : '⏳ Ready to Claim'}</span>
            ${
              isClaimedToday
                ? `<button class="action-btn" style="background:#475569; width:auto; padding:6px 14px; margin:0; cursor:not-allowed;" disabled>Claimed</button>`
                : `<button class="action-btn" style="background:#27ae60; width:auto; padding:6px 14px; margin:0;" onclick="app.claimPackageEarning('${docId}',${dailyProfit})">Claim KES ${dailyProfit}</button>`
            }
          </div>
        </div>
      `;
    });

    todayEarningsEl.innerText = `KES ${todayPotential.toLocaleString()}`;
    earningsList.innerHTML = html;

  } catch (err) {
    earningsList.innerHTML = "<p style='color:red;'>Failed to load earnings data.</p>";
  }
};

window.app.claimPackageEarning = async function(investmentDocId, amount) {
  try {
    const userId = window.app.currentUser.uid;
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Update user balance & total earnings in Firestore
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const currentBal = userDoc.data().balance || 0;
    const currentTotalEarnings = userDoc.data().totalEarnings || 0;

    await userRef.update({
      balance: currentBal + amount,
      totalEarnings: currentTotalEarnings + amount
    });

    // 2. Mark package as claimed today
    await db.collection("userInvestments").doc(investmentDocId).update({
      lastClaimedDate: todayStr
    });

    // 3. Record claim in transaction history
    await db.collection("depositRequests").add({
      userId: userId,
      amount: amount,
      mpesaCode: "DAILY EARNING CLAIM",
      status: "approved",
      createdAt: new Date()
    });

    // Refresh UI
    window.app.userData.balance = currentBal + amount;
    window.app.updateUI();
    window.app.showAlert(`Successfully claimed KES ${amount}! Added to your balance.`);
    window.app.loadEarnings();

  } catch (err) {
    window.app.showAlert("Failed to claim earnings: " + err.message, true);
  }
};
