// =========================================================================
// 1. IMPORTATIONS ET CONFIGURATION FIREBASE
// =========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, addDoc, collection } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDmwolOcWtfesehxqyxxk7-erLuUZ6OQYw",
    authDomain: "cashflow-1bcad.firebaseapp.com",
    projectId: "cashflow-1bcad",
    storageBucket: "cashflow-1bcad.firebasestorage.app",
    messagingSenderId: "190480009995",
    appId: "1:190480009995:web:eff1dd2b4703256fdd700e"
};

// Initialisation avec gestion d'erreur basique
let app, auth, db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("✅ Firebase initialisé avec succès !");
} catch (error) {
    console.error("❌ Erreur critique lors de l'initialisation de Firebase :", error);
}

let currentUserUid = null;
let userTransactionPin = "1234";
let currentSelectedChannel = "";

// =========================================================================
// 2. FONCTION DE MISE À JOUR DU TABLEAU DE BORD
// =========================================================================
async function refreshDashboardMetrics(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            userTransactionPin = data.transactionPin || "1234";

            // Sécurisation de l'affichage avec des vérifications
            const updateElement = (id, text) => {
                const el = document.getElementById(id);
                if (el) el.innerText = text;
            };

            // Blocs financiers
            updateElement('mainBalance', `${data.balance || 0} FCFA`);
            updateElement('mainActivePacks', data.activePacksCount || 0);
            updateElement('mainDailyProfit', `${data.dailyProfit || 0} FCFA`);

            // Informations de la sidebar
            updateElement('sbUsername', data.username || "Utilisateur");
            updateElement('sbUid', `ID : ${uid}`);
            updateElement('sbBalance', `${data.balance || 0} FCFA`);
            
            if (auth.currentUser) updateElement('sbUserEmail', auth.currentUser.email);

            // Gestion de l'Avatar
            const avatarContainer = document.getElementById('sbAvatar');
            if (avatarContainer) {
                if (data.avatarUrl && data.avatarUrl.trim() !== "") {
                    avatarContainer.innerHTML = `<img src="${data.avatarUrl}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="Avatar">`;
                } else {
                    avatarContainer.innerHTML = "👤";
                }
            }
            
            // Lien d'affiliation (Adaptation automatique)
            const refInput = document.getElementById('sbRefLink');
            if (refInput) {
                refInput.value = `${window.location.origin}/?ref=${uid}`;
            }
        } else {
            console.warn("⚠️ Le document utilisateur n'existe pas dans Firestore.");
        }
    } catch (e) { 
        console.error("❌ Erreur de récupération des données depuis Firestore :", e); 
        alert("Problème de connexion avec la base de données.");
    }
}

// =========================================================================
// 3. GESTION DE LA SESSION UTILISATEUR
// =========================================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        console.log("✅ Utilisateur connecté :", user.uid);
        
        // Attendre que le HTML soit prêt avant d'injecter les données
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => refreshDashboardMetrics(user.uid));
        } else {
            await refreshDashboardMetrics(user.uid);
        }
    } else {
        console.log("⚠️ Aucun utilisateur connecté. Redirection...");
        window.location.href = "index.html";
    }
});

// =========================================================================
// 4. ÉVÉNEMENTS D'INTERFACE ET BOUTONS
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById('mainSidebar');

    // --- Utilitaires ---
    const toggleModal = (id, action) => {
        const target = document.getElementById(id);
        if (target) target.style.display = action === 'open' ? 'flex' : 'none';
    };

    const attachClick = (id, callback) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', callback);
    };

    // --- Menu Latéral ---
    attachClick('sidebarOpenBtn', () => sidebar?.classList.add('open'));
    attachClick('sidebarCloseBtn', () => sidebar?.classList.remove('open'));

    // --- Profil ---
    attachClick('sbUsernameEdit', async () => {
        const newName = prompt("Entrez votre nouveau nom d'affichage :");
        if (newName && newName.trim() !== "" && currentUserUid) {
            try {
                await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                await refreshDashboardMetrics(currentUserUid);
            } catch(err) {
                console.error("Erreur mise à jour pseudo:", err);
                alert("Erreur lors du changement de nom.");
            }
        }
    });

    attachClick('sbAvatarEdit', async () => {
        const newAvatarUrl = prompt("Entrez l'URL de votre nouvelle photo de profil :");
        if (newAvatarUrl && newAvatarUrl.trim() !== "" && currentUserUid) {
            try {
                await updateDoc(doc(db, "users", currentUserUid), { avatarUrl: newAvatarUrl.trim() });
                await refreshDashboardMetrics(currentUserUid);
                alert("Photo de profil mise à jour avec succès !");
            } catch(err) {
                alert("Erreur lors de la mise à jour de la photo de profil.");
            }
        }
    });

    // --- Affiliation ---
    attachClick('sbCopyRefBtn', () => {
        const copyText = document.getElementById('sbRefLink');
        if (copyText) {
            copyText.select();
            navigator.clipboard.writeText(copyText.value);
            alert("Lien de parrainage copié !");
        }
    });

    // --- Déconnexion ---
    attachClick('topLogoutBtn', async () => {
        try { await signOut(auth); window.location.href = "index.html"; } 
        catch(e) { window.location.href = "index.html"; }
    });

    // --- Modales : Dépôt ---
    attachClick('sbDepositBtn', () => { sidebar?.classList.remove('open'); toggleModal('modalDepositChoice', 'open'); });
    attachClick('depChoiceClose', () => toggleModal('modalDepositChoice', 'close'));
    attachClick('depChoiceCrypto', () => { toggleModal('modalDepositChoice', 'close'); toggleModal('modalDepositCryptoForm', 'open'); });
    attachClick('cryptoDepBack', () => { toggleModal('modalDepositCryptoForm', 'close'); toggleModal('modalDepositChoice', 'open'); });
    attachClick('depChoiceMomo', () => alert("Redirection vers Fusion Money..."));

    attachClick('cryptoDepSubmit', async () => {
        const amountInput = document.getElementById('cryptoDepAmount');
        const refInput = document.getElementById('cryptoDepRef');
        if (!amountInput || !refInput) return;

        const amount = parseInt(amountInput.value);
        const ref = refInput.value.trim();
        if (!amount || !ref) return alert("Veuillez remplir tous les champs.");

        try {
            await addDoc(collection(db, "deposits"), {
                userId: currentUserUid, amount, reference: ref, channel: "Crypto", status: "En attente", createdAt: new Date()
            });
            alert("Reçu enregistré !");
            toggleModal('modalDepositCryptoForm', 'close');
            amountInput.value = ""; refInput.value = "";
        } catch(e) { console.error(e); alert("Erreur de soumission."); }
    });

    // --- Modales : Retrait ---
    attachClick('sbWithdrawBtn', () => { sidebar?.classList.remove('open'); toggleModal('modalWithdrawChoice', 'open'); });
    attachClick('witChoiceClose', () => toggleModal('modalWithdrawChoice', 'close'));

    const openWithdrawalForm = (channelName) => {
        currentSelectedChannel = channelName;
        toggleModal('modalWithdrawChoice', 'close');
        toggleModal('modalWithdrawForm', 'open');
    };

    attachClick('witChoiceMomo', () => openWithdrawalForm("Mobile Money"));
    attachClick('witChoiceCrypto', () => openWithdrawalForm("Crypto"));
    attachClick('witFormBack', () => { toggleModal('modalWithdrawForm', 'close'); toggleModal('modalWithdrawChoice', 'open'); });

    attachClick('witFormSubmit', async () => {
        const amount = parseInt(document.getElementById('witAmount')?.value);
        const recipient = document.getElementById('witRecipient')?.value.trim();
        const pin = document.getElementById('witPin')?.value.trim();

        if (amount < 2050) return alert("Minimum de retrait : 2 050 FCFA");
        if (pin !== userTransactionPin) return alert("PIN de transaction incorrect.");

        try {
            const userRef = doc(db, "users", currentUserUid);
            const bal = (await getDoc(userRef)).data().balance || 0;

            if (bal < amount) return alert("Solde insuffisant.");

            await updateDoc(userRef, { balance: bal - amount });
            await addDoc(collection(db, "withdrawals"), {
                userId: currentUserUid, amount, destination: recipient, channel: currentSelectedChannel, status: "En attente", createdAt: new Date()
            });

            alert("Retrait envoyé à la validation !");
            toggleModal('modalWithdrawForm', 'close');
            await refreshDashboardMetrics(currentUserUid);
        } catch(e) { console.error(e); alert("Erreur système lors du retrait."); }
    });

    // --- Modales : Transfert ---
    attachClick('sbTransferBtn', () => { sidebar?.classList.remove('open'); toggleModal('modalTransferForm', 'open'); });
    attachClick('transClose', () => toggleModal('modalTransferForm', 'close'));

    attachClick('transSubmit', async () => {
        const targetId = document.getElementById('transTargetId')?.value.trim();
        const amount = parseInt(document.getElementById('transAmount')?.value);
        const pin = document.getElementById('transPin')?.value.trim();

        if (!targetId || !amount || pin !== userTransactionPin) return alert("Champs invalides ou mauvais PIN.");
        if (targetId === currentUserUid) return alert("Action non autorisée sur soi-même.");

        try {
            const userRef = doc(db, "users", currentUserUid);
            const targetRef = doc(db, "users", targetId);
            
            const senderSnap = await getDoc(userRef);
            const targetSnap = await getDoc(targetRef);

            if (!targetSnap.exists()) return alert("ID destinataire invalide.");
            if ((senderSnap.data().balance || 0) < amount) return alert("Fonds insuffisants.");

            await updateDoc(userRef, { balance: (senderSnap.data().balance || 0) - amount });
            await updateDoc(targetRef, { balance: (targetSnap.data().balance || 0) + amount });

            alert("Transfert instantané validé !");
            toggleModal('modalTransferForm', 'close');
            await refreshDashboardMetrics(currentUserUid);
        } catch(e) { console.error(e); alert("Échec lors de la transaction."); }
    });

    // --- Achat de Robots ---
    async function executePackPurchase(packName, price, dailyRevenue) {
        try {
            const userRef = doc(db, "users", currentUserUid);
            const userSnap = await getDoc(userRef);
            const currentBalance = userSnap.data().balance || 0;

            if (currentBalance < price) return alert("Solde insuffisant.");

            await updateDoc(userRef, {
                balance: currentBalance - price,
                activePacksCount: (userSnap.data().activePacksCount || 0) + 1,
                dailyProfit: (userSnap.data().dailyProfit || 0) + dailyRevenue
            });

            await addDoc(collection(db, "purchases"), {
                userId: currentUserUid, packName, price, purchasedAt: new Date()
            });

            alert(`Activation réussie pour le ${packName} !`);
            await refreshDashboardMetrics(currentUserUid);
        } catch (err) { console.error(err); alert("Impossible de finaliser l'achat."); }
    }

    attachClick('buyViperBtn', () => executePackPurchase("Viper Bot", 2000, 100));
    attachClick('buyExtincteurBtn', () => executePackPurchase("Extincteur Bot", 4000, 220));
    attachClick('buyCycloneBtn', () => executePackPurchase("Cyclone Bot", 10000, 600));

    // --- Compteur 24h ---
    function updateCountdown() {
        const counterEl = document.getElementById('countdownTimer');
        if (!counterEl) return;

        const now = new Date();
        const nextPayout = new Date();
        nextPayout.setHours(24, 0, 0, 0);
        const diff = nextPayout - now;

        if (diff <= 0) {
            counterEl.innerText = "Distribution en cours...";
            return;
        }

        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        counterEl.innerText = `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    }

    setInterval(updateCountdown, 1000);
    updateCountdown();
});
