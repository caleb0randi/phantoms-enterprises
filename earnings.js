window.app.loadEarnings = async function() {
  const earningsList = document.getElementById('earningsPackageList');
  const totalEarningsEl = document.getElementById('totalEarningsDisplay');

  if (!earningsList) return;
  earningsList.innerHTML = "<p style='color:#64748b; font-size:14px;'>Loading rental packages...</p>";

  try {
    const userId = window.app.currentUser.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data() || {};
    const totalEarnings = userData.totalEarnings || 0;
    if (totalEarningsEl) totalEarningsEl.innerText = `KES ${totalEarnings.toLocaleString()}`;

    const profitRates = {
      'Phantom Rig Alpha': 150,
      'Phantom Rig Pro': 500,
      'Phantom Enterprise Stack': 1800
    };

    const snapshot = await db.collection("userInvestments")
      .where("userId", "==", userId)
      .get();

    if (snapshot.empty) {
      earningsList.innerHTML = "<p style='color:#64748b; font-size:14px;'>No active rental packages found.</p>";
      return;
    }

    let html = "";
    const todayStr = new Date().toISOString().split('T')[0];

    snapshot.forEach(doc => {
      const data = doc.data();
      const docId = doc.id;
      const dailyProfit = profitRates[data.packageName] || 150;
      const isClaimedToday = data.lastClaimedDate === todayStr;

      html += `
        <div style="background:#1e293b; border:1px solid #334155; padding:12px; border-radius:8px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:#ffffff;">${data.packageName}</strong>
            <span style="color:#27ae60; font-weight:bold;">+KES ${dailyProfit}/day</span>
          </div>
          <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
            <span style="color:#94a3b8; font-size:0.8rem;">Status: ${isClaimedToday ? '✅ Claimed' : '⏳ Ready to Claim'}</span>
            ${
              isClaimedToday
                ? `<button class="action-btn" style="background:#475569; width:auto; padding:5px 10px; margin:0; cursor:not-allowed;" disabled>Claimed</button>`
                : `<button class="action-btn" style="background:#27ae60; width:auto; padding:5px 10px; margin:0;" onclick="app.claimPackageEarning('${docId}',${dailyProfit})">Claim KES ${dailyProfit}</button>`
            }
          </div>
        </div>
      `;
    });

    earningsList.innerHTML = html;

  } catch (err) {
    earningsList.innerHTML = "<p style='color:red;'>Failed to load earnings.</p>";
  }
};

window.app.claimPackageEarning = async function(investmentDocId, amount) {
  try {
    const userId = window.app.currentUser.uid;
    const todayStr = new Date().toISOString().split('T')[0];

    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();
    const currentBal = userDoc.data().balance || 0;
    const currentTotal = userDoc.data().totalEarnings || 0;

    await userRef.update({
      balance: currentBal + amount,
      totalEarnings: currentTotal + amount
    });

    await db.collection("userInvestments").doc(investmentDocId).update({
      lastClaimedDate: todayStr
    });

    window.app.userData.balance = currentBal + amount;
    window.app.updateUI();
    window.app.showAlert(`Successfully claimed KES ${amount}! Added to balance.`);
    window.app.loadEarnings();

  } catch (err) {
    window.app.showAlert("Claim failed: " + err.message, true);
  }
};
