// =========================================================================
// CORRECTION : SYNCHRONISATION DES STATISTIQUES DU TABLEAU DE BORD (DASHBOARD)
// =========================================================================
async function refreshDashboardMetrics(uid) {
    try {
        // Récupération du document de l'utilisateur dans Firestore
        const userDoc = await getDoc(doc(db, "users", uid));
        
        if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Stockage global sécurisé du code PIN
            userTransactionPin = data.transactionPin || "1234";

            // 1. MISE À JOUR DES STATISTIQUES PRINCIPALES (Image 149979.jpg)
            const mainBalanceEl = document.getElementById('user-balance');
            if (mainBalanceEl) mainBalanceEl.innerText = `${data.balance || 0} FCFA`;

            const activePacksEl = document.getElementById('active-packs');
            if (activePacksEl) activePacksEl.innerText = data.activePacksCount || 0;

            const dailyProfitEl = document.getElementById('daily-profit');
            if (dailyProfitEl) dailyProfitEl.innerText = `${data.dailyProfit || 0} FCFA`;


            // 2. MISE À JOUR DU PROFIL DANS LA SIDEBAR (Image 149980.jpg)
            // .innerText préserve l'émoji crayon ✏️ qui est en dehors de cette balise span/div
            const usernameEl = document.getElementById('profile-display-name');
            if (usernameEl) usernameEl.innerText = data.username || "KAZOS";

            const uidEl = document.getElementById('profile-display-id');
            if (uidEl) uidEl.innerText = uid;

            const sidebarBalanceEl = document.getElementById('profile-display-balance');
            if (sidebarBalanceEl) sidebarBalanceEl.innerText = `${data.balance || 0} FCFA`;


            // 3. MISE À JOUR SÉCURISÉE DE L'AVATAR (Image 149980.jpg)
            // On change uniquement la source (.src) de l'image. Le bouton photo 📷 reste inchangé.
            const avatarImg = document.getElementById('user-profile-img');
            if (avatarImg && data.avatarUrl && data.avatarUrl.trim() !== "") {
                avatarImg.src = data.avatarUrl;
            }


            // 4. LIEN D'AFFILIATION DYNAMIQUE (Génère le lien selon l'hébergeur actuel)
            const referralInput = document.getElementById('referral-link');
            if (referralInput) {
                const currentHost = window.location.origin; // Récupère https://v226.netlify.app ou localhost
                referralInput.value = `${currentHost}/?ref=${uid}`;
            }
        }
    } catch (error) {
        console.error("Erreur lors du rafraîchissement des données :", error);
    }
}

// =========================================================================
// ÉCOUTEUR D'ÉVÉNEMENT : CHANGEMENT DE LA PHOTO DE PROFIL
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const avatarFileInput = document.getElementById('avatar-input-file');
    const avatarImg = document.getElementById('user-profile-img');

    if (avatarFileInput) {
        // Cet écouteur se déclenche dès que l'utilisateur sélectionne une image dans sa galerie
        avatarFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                // Validation simple du type de fichier
                if (!file.type.startsWith('image/')) {
                    alert("Veuillez sélectionner un fichier image valide.");
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    const base64Image = e.target.result;
                    
                    // Si l'utilisateur est bien connecté, on sauvegarde dans Firestore
                    if (typeof currentUserUid !== 'undefined' && currentUserUid) {
                        try {
                            const userRef = doc(db, "users", currentUserUid);
                            await updateDoc(userRef, { avatarUrl: base64Image });
                            
                            // Mise à jour visuelle immédiate
                            if (avatarImg) avatarImg.src = base64Image;
                            alert("Votre photo de profil a été mise à jour avec succès !");
                        } catch (err) {
                            console.error("Erreur Firebase lors de l'enregistrement de l'image :", err);
                            alert("Impossible de sauvegarder la photo sur le serveur.");
                        }
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }
});
