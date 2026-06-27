// =========================================================================
// FONCTION DE MISE À JOUR SÉCURISÉE DES STATISTIQUES (PRÉSERVE LE DESIGN)
// =========================================================================
async function refreshDashboardMetrics(uid) {
    try {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            userTransactionPin = data.transactionPin || "1234";

            // 1. MISE À JOUR DES STATISTIQUES DE LA PAGE PRINCIPALE (Image 149979.jpg)
            // On cible uniquement le texte pour ne pas supprimer les styles CSS des cartes
            const balanceEl = document.getElementById('mainBalance');
            if (balanceEl) balanceEl.innerText = `${data.balance || 0} FCFA`;

            const packsEl = document.getElementById('mainActivePacks');
            if (packsEl) packsEl.innerText = data.activePacksCount || 0;

            const profitEl = document.getElementById('mainDailyProfit');
            // Calcule ou affiche directement le revenu journalier (ex: 2000 FCFA)
            if (profitEl) profitEl.innerText = `${data.dailyProfit || 0} FCFA`;


            // 2. MISE À JOUR DU PANNEAU LATÉRAL / SIDEBAR (Image 149980.jpg)
            
            // Pseudo : On change le texte du pseudo "KAZOS" sans toucher au bouton crayon ou au drapeau
            const usernameEl = document.getElementById('sbUsername');
            if (usernameEl) usernameEl.innerText = data.username || "KAZOS";

            // ID Unique
            const uidEl = document.getElementById('sbUid');
            if (uidEl) uidEl.innerText = `ID : ${uid}`;

            // Solde dans la Sidebar
            const sbBalanceEl = document.getElementById('sbBalance');
            if (sbBalanceEl) sbBalanceEl.innerText = `${data.balance || 0} FCFA`;

            // Email de connexion en bas
            const emailEl = document.getElementById('sbUserEmail');
            if (emailEl) emailEl.innerText = auth.currentUser ? auth.currentUser.email : "...";


            // 3. CORRECTION DE L'AVATAR (Image 149980.jpg)
            // On cible la balise <img> à l'intérieur pour changer la photo sans supprimer le bouton appareil photo
            const avatarImg = document.querySelector('#sbAvatar img') || document.getElementById('userAvatarSrc');
            if (avatarImg && data.avatarUrl && data.avatarUrl.trim() !== "") {
                avatarImg.src = data.avatarUrl;
            }


            // 4. LIEN D'AFFILIATION DYNAMIQUE (Netlify / Vercel)
            const refLinkInput = document.getElementById('sbRefLink');
            if (refLinkInput) {
                const currentHost = window.location.origin; // Capte automatiquement https://v226.netlify.app
                refLinkInput.value = `${currentHost}/?ref=${uid}`;
            }
        }
    } catch (e) { 
        console.error("Erreur lors de la synchronisation des données :", e); 
    }
}

// =========================================================================
// ÉCOUTEUR D'ÉVÉNEMENT POUR L'IMPORTATION DE L'AVATAR DEPUIS LA GALERIE
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    // Écouteur sur le bouton de l'appareil photo violet (sbAvatarEdit)
    const avatarEditBtn = document.getElementById('sbAvatarEdit');
    const avatarFileInput = document.getElementById('avatarFileInput');

    if (avatarEditBtn && avatarFileInput) {
        // Au clic sur l'appareil photo, on ouvre la galerie du téléphone
        avatarEditBtn.addEventListener('click', () => {
            avatarFileInput.click();
        });

        // Dès qu'une image est choisie
        avatarFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                if (!file.type.startsWith('image/')) {
                    alert("Veuillez sélectionner un fichier image valide.");
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Image = e.target.result;
                    if (currentUserUid) {
                        try {
                            // Sauvegarde dans la base de données Firestore
                            await updateDoc(doc(db, "users", currentUserUid), { avatarUrl: base64Image });
                            // Rafraîchissement immédiat de l'affichage
                            await refreshDashboardMetrics(currentUserUid);
                            alert("Votre photo de profil a été mise à jour !");
                        } catch (err) {
                            console.error("Erreur d'enregistrement Firebase :", err);
                            alert("Erreur lors de la sauvegarde de l'image.");
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});
