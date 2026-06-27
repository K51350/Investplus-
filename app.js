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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserUid = null;
let userTransactionPin = "1234";
let currentSelectedChannel = "";

// FONCTION DE MISE À JOUR (Sécurisée contre le chargement précoce)
async function refreshDashboardMetrics(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            userTransactionPin = data.transactionPin || "1234";

            // Vérification systématique de l'existence des éléments HTML avant modification
            if(document.getElementById('mainBalance')) document.getElementById('mainBalance').innerText = `${data.balance || 0} FCFA`;
            if(document.getElementById('mainActivePacks')) document.getElementById('mainActivePacks').innerText = data.activePacksCount || 0;
            if(document.getElementById('mainDailyProfit')) document.getElementById('mainDailyProfit').innerText = `${data.dailyProfit || 0} FCFA`;

            if(document.getElementById('sbUsername')) document.getElementById('sbUsername').innerText = data.username || "Utilisateur";
            if(document.getElementById('sbUid')) document.getElementById('sbUid').innerText = `ID : ${uid}`;
            if(document.getElementById('sbBalance')) document.getElementById('sbBalance').innerText = `${data.balance || 0} FCFA`;
            
            if(auth.currentUser && document.getElementById('sbUserEmail')) {
                document.getElementById('sbUserEmail').innerText = auth.currentUser.email;
            }
            
            if(document.getElementById('sbRefLink')) {
                document.getElementById('sbRefLink').value = `https://cash-flow226.netlify.app/?ref=${uid}`;
            }
        }
    } catch (e) { 
        console.error("Erreur de synchronisation metrics:", e); 
    }
}

// SURVEILLANCE DE L'AUTHENTIFICATION
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserUid = user.uid;
        // On attend que le DOM soit complètement chargé avant d'injecter les données
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => refreshDashboardMetrics(user.uid));
        } else {
            await refreshDashboardMetrics(user.uid);
        }
    } else {
        window.location.href = "index.html";
    }
});

// INITIALISATION DES ÉVÉNEMENTS DU TABLEAU DE BORD
document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById('mainSidebar');

    // Ouverture et fermeture de la Sidebar
    if(document.getElementById('sidebarOpenBtn')) {
        document.getElementById('sidebarOpenBtn').addEventListener('click', () => sidebar.classList.add('open'));
    }
    if(document.getElementById('sidebarCloseBtn')) {
        document.getElementById('sidebarCloseBtn').addEventListener('click', () => sidebar.classList.remove('open'));
    }

    // Changement de nom (Crayon ✏️)
    if(document.getElementById('sbUsernameEdit')) {
        document.getElementById('sbUsernameEdit').addEventListener('click', async () => {
            const newName = prompt("Entrez votre nouveau nom d'affichage :");
            if(newName && newName.trim() !== "" && currentUserUid) {
                try {
                    await updateDoc(doc(db, "users", currentUserUid), { username: newName.trim() });
                    await refreshDashboardMetrics(currentUserUid);
                } catch(err) {
                    alert("Erreur lors de la mise à jour du nom.");
                }
            }
        });
    }

    // Copie du lien d'affiliation
    if(document.getElementById('sbCopyRefBtn')) {
        document.getElementById('sbCopyRefBtn').addEventListener('click', () => {
            const copyText = document.getElementById('sbRefLink');
            if(copyText) {
                copyText.select();
                copyText.setSelectionRange(0, 99999);
                navigator.clipboard.writeText(copyText.value);
                alert("Lien de parrainage copié avec succès !");
            }
        });
    }

    // Déconnexion
    const disconnectUser = async () => { 
        try {
            await signOut(auth); 
            window.location.href = "index.html"; 
        } catch(err) {
            window.location.href = "index.html";
        }
    };
    if(document.getElementById('topLogoutBtn')) document.getElementById('topLogoutBtn').addEventListener('click', disconnectUser);

    // Gestion des fenêtres Modales (Fonction générique sécurisée)
    const toggleModal = (id, action) => {
        const target = document.getElementById(id);
        if(target) target.style.display = action === 'open' ? 'flex' : 'none';
    };

    // --- PASSERELLE DÉPÔT ---
    if(document.getElementById('sbDepositBtn')) {
        document.getElementById('sbDepositBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalDepositChoice', 'open'); 
        });
    }
    if(document.getElementById('depChoiceClose')) {
        document.getElementById('depChoiceClose').addEventListener('click', () => toggleModal('modalDepositChoice', 'close'));
    }
    if(document.getElementById('depChoiceCrypto')) {
        document.getElementById('depChoiceCrypto').addEventListener('click', () => { 
            toggleModal('modalDepositChoice', 'close'); 
            toggleModal('modalDepositCryptoForm', 'open'); 
        });
    }
    if(document.getElementById('cryptoDepBack')) {
        document.getElementById('cryptoDepBack').addEventListener('click', () => { 
            toggleModal('modalDepositCryptoForm', 'close'); 
            toggleModal('modalDepositChoice', 'open'); 
        });
    }

    // Gestion Mobile Money (Fusion Money)
    if(document.getElementById('depChoiceMomo')) {
        document.getElementById('depChoiceMomo').addEventListener('click', () => {
            alert("Redirection vers la passerelle de paiement sécurisée Fusion Money...");
        });
    }

    // Soumission Reçu Crypto
    if(document.getElementById('cryptoDepSubmit')) {
        document.getElementById('cryptoDepSubmit').addEventListener('click', async () => {
            const amountInput = document.getElementById('cryptoDepAmount');
            const refInput = document.getElementById('cryptoDepRef');
            
            if(!amountInput || !refInput) return;
            
            const amount = parseInt(amountInput.value);
            const ref = refInput.value.trim();
            
            if(!amount || !ref) { alert("Veuillez remplir toutes les cases."); return; }
            
            try {
                await addDoc(collection(db, "deposits"), {
                    userId: currentUserUid, amount: amount, reference: ref, channel: "Crypto", status: "En attente", createdAt: new Date()
                });
                alert("Reçu soumis avec succès. Traitement en cours par l'administration.");
                toggleModal('modalDepositCryptoForm', 'close');
                amountInput.value = "";
                refInput.value = "";
            } catch(e) {
                alert("Erreur lors de la soumission du dépôt.");
            }
        });
    }

    // --- PASSERELLE RETRAIT ---
    if(document.getElementById('sbWithdrawBtn')) {
        document.getElementById('sbWithdrawBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalWithdrawChoice', 'open'); 
        });
    }
    if(document.getElementById('witChoiceClose')) {
        document.getElementById('witChoiceClose').addEventListener('click', () => toggleModal('modalWithdrawChoice', 'close'));
    }
    
    const openWithdrawalForm = (channelName) => {
        currentSelectedChannel = channelName;
        toggleModal('modalWithdrawChoice', 'close');
        toggleModal('modalWithdrawForm', 'open');
    };
    
    if(document.getElementById('witChoiceMomo')) document.getElementById('witChoiceMomo').addEventListener('click', () => openWithdrawalForm("Mobile Money"));
    if(document.getElementById('witChoiceCrypto')) document.getElementById('witChoiceCrypto').addEventListener('click', () => openWithdrawalForm("Crypto"));
    
    if(document.getElementById('witFormBack')) {
        document.getElementById('witFormBack').addEventListener('click', () => { 
            toggleModal('modalWithdrawForm', 'close'); 
            toggleModal('modalWithdrawChoice', 'open'); 
        });
    }

    // Validation formulaire de retrait
    if(document.getElementById('witFormSubmit')) {
        document.getElementById('witFormSubmit').addEventListener('click', async () => {
            const amountInput = document.getElementById('witAmount');
            const recipientInput = document.getElementById('witRecipient');
            const pinInput = document.getElementById('witPin');

            if(!amountInput || !recipientInput || !pinInput) return;

            const amount = parseInt(amountInput.value);
            const recipient = recipientInput.value.trim();
            const pin = pinInput.value.trim();

            if(amount < 2050) { alert("Retrait minimum de 2 050 FCFA requis."); return; }
            if(pin !== userTransactionPin) { alert("Code PIN de transaction incorrect."); return; }

            try {
                const userRef = doc(db, "users", currentUserUid);
                const snap = await getDoc(userRef);
                const bal = snap.data().balance || 0;
                
                if(bal < amount) { alert("Solde de compte insuffisant."); return; }

                await updateDoc(userRef, { balance: bal - amount });
                await addDoc(collection(db, "withdrawals"), {
                    userId: currentUserUid, amount: amount, destination: recipient, channel: currentSelectedChannel, status: "En attente", createdAt: new Date()
                });
                
                alert("Demande de retrait enregistrée. Votre solde a été mis à jour.");
                toggleModal('modalWithdrawForm', 'close');
                
                amountInput.value = "";
                recipientInput.value = "";
                pinInput.value = "";
                
                await refreshDashboardMetrics(currentUserUid);
            } catch(err) {
                alert("Une erreur est survenue lors de votre demande de retrait.");
            }
        });
    }

    // --- TRANSFERT INTER-COMPTE ---
    if(document.getElementById('sbTransferBtn')) {
        document.getElementById('sbTransferBtn').addEventListener('click', () => { 
            if(sidebar) sidebar.classList.remove('open'); 
            toggleModal('modalTransferForm', 'open'); 
        });
    }
    if(document.getElementById('transClose')) {
        document.getElementById('transClose').addEventListener('click', () => toggleModal('modalTransferForm', 'close'));
    }

    if(document.getElementById('transSubmit')) {
        document.getElementById('transSubmit').addEventListener('click', async () => {
            const targetInput = document.getElementById('transTargetId');
            const amountInput = document.getElementById('transAmount');
            const pinInput = document.getElementById('transPin');

            if(!targetInput || !amountInput || !pinInput) return;

            const targetId = targetInput.value.trim();
            const amount = parseInt(amountInput.value);
            const pin = pinInput.value.trim();

            if(!targetId || !amount || pin !== userTransactionPin) { alert("Données invalides ou Code PIN erroné."); return; }
            if(targetId === currentUserUid) { alert("Vous ne pouvez pas vous transférer des fonds à vous-même."); return; }

            try {
                const userRef = doc(db, "users", currentUserUid);
                const userSnap = await getDoc(userRef);
                const senderBalance = userSnap.data().balance || 0;
                
                if(senderBalance < amount) { alert("Solde insuffisant."); return; }

                const targetRef = doc(db, "users", targetId);
                const targetSnap = await getDoc(targetRef);
                if(!targetSnap.exists()) { alert("Bénéficiaire introuvable sur le réseau."); return; }

                await updateDoc(userRef, { balance: senderBalance - amount });
                await updateDoc(targetRef, { balance: (targetSnap.data().balance || 0) + amount });

                alert("Transfert instantané exécuté avec succès !");
                toggleModal('modalTransferForm', 'close');
                
                targetInput.value = "";
                amountInput.value = "";
                pinInput.value = "";

                await refreshDashboardMetrics(currentUserUid);
            } catch(e) {
                alert("Erreur technique durant le transfert.");
            }
        });
    }

    // --- LOGIQUE D'ACTIVATION DES PACKS ---
    async function executePackPurchase(packName, price, dailyRevenue) {
        try {
            const userRef = doc(db, "users", currentUserUid);
            const userSnap = await getDoc(userRef);
            const currentBalance = userSnap.data().balance || 0;

            if (currentBalance < price) { alert("Erreur : Solde insuffisant pour acquérir ce robot."); return; }

            await updateDoc(userRef, {
                balance: currentBalance - price,
                activePacksCount: (userSnap.data().activePacksCount || 0) + 1,
                dailyProfit: (userSnap.data().dailyProfit || 0) + dailyRevenue
            });

            await addDoc(collection(db, "purchases"), {
                userId: currentUserUid, packName: packName, price: price, purchasedAt: new Date()
            });

            alert(`Félicitations ! Le ${packName} a été déployé avec succès.`);
            await refreshDashboardMetrics(currentUserUid);
        } catch (err) { 
            alert("Une erreur est survenue lors de l'achat du pack."); 
        }
    }

    if(document.getElementById('buyViperBtn')) document.getElementById('buyViperBtn').addEventListener('click', () => executePackPurchase("Viper Bot", 2000, 100));
    if(document.getElementById('buyExtincteurBtn')) document.getElementById('buyExtincteurBtn').addEventListener('click', () => executePackPurchase("Extincteur Bot", 4000, 220));
    if(document.getElementById('buyCycloneBtn')) document.getElementById('buyCycloneBtn').addEventListener('click', () => executePackPurchase("Cyclone Bot", 10000, 600));
});
