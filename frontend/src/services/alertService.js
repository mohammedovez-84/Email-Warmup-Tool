// services/alertService.js
import {
    db,
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    getDocs,
    serverTimestamp
} from '../config/firebase';

// Collection references
const ALERTS_COLLECTION = 'alerts';
const ACCOUNTS_COLLECTION = 'emailAccounts';

// Alert Service with real-time monitoring
export const alertService = {
    // Get real-time alerts for an account
    subscribeToAlerts: (accountId, callback, errorCallback = null) => {
        try {
            const q = query(
                collection(db, ALERTS_COLLECTION),
                where('accountId', '==', accountId),
                orderBy('timestamp', 'desc')
            );

            return onSnapshot(q,
                (snapshot) => {
                    const alerts = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            // Handle Firestore Timestamp conversion
                            timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
                            readAt: data.readAt?.toDate?.() || (data.readAt ? new Date(data.readAt) : null),
                            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
                        };
                    });
                    callback(alerts);
                },
                (error) => {
                    console.error('Error in alerts subscription:', error);
                    if (errorCallback) errorCallback(error);
                }
            );
        } catch (error) {
            console.error('Error setting up alerts subscription:', error);
            if (errorCallback) errorCallback(error);
            return () => { };
        }
    },

    // Get real-time email accounts for user
    subscribeToAccounts: (userId, callback, errorCallback = null) => {
        try {
            const q = query(
                collection(db, ACCOUNTS_COLLECTION),
                where('userId', '==', userId),
                orderBy('lastChecked', 'desc')
            );

            return onSnapshot(q,
                (snapshot) => {
                    const accounts = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            ...data,
                            // Handle Firestore Timestamp conversion
                            lastChecked: data.lastChecked?.toDate?.() || new Date(data.lastChecked),
                            createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
                            updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
                        };
                    });
                    callback(accounts);
                },
                (error) => {
                    console.error('Error in accounts subscription:', error);
                    if (errorCallback) errorCallback(error);
                }
            );
        } catch (error) {
            console.error('Error setting up accounts subscription:', error);
            if (errorCallback) errorCallback(error);
            return () => { };
        }
    },

    // Mark alert as read
    markAlertAsRead: async (alertId) => {
        try {
            await updateDoc(doc(db, ALERTS_COLLECTION, alertId), {
                read: true,
                readAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return true;
        } catch (error) {
            console.error('Error marking alert as read:', error);
            throw error;
        }
    },

    // Mark all alerts as read for an account
    markAllAlertsAsRead: async (accountId) => {
        try {
            const q = query(
                collection(db, ALERTS_COLLECTION),
                where('accountId', '==', accountId),
                where('read', '==', false)
            );

            const snapshot = await getDocs(q);
            const updatePromises = snapshot.docs.map(doc =>
                updateDoc(doc.ref, {
                    read: true,
                    readAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                })
            );

            await Promise.all(updatePromises);
            return true;
        } catch (error) {
            console.error('Error marking all alerts as read:', error);
            throw error;
        }
    },

    // Create a new alert
    createAlert: async (alertData) => {
        try {
            const docRef = await addDoc(collection(db, ALERTS_COLLECTION), {
                ...alertData,
                timestamp: serverTimestamp(),
                read: false,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error creating alert:', error);
            throw error;
        }
    }
};