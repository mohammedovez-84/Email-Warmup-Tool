import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
    apiKey: "AIzaSyA4pp3a1Z7fP9Jy71ilw3RFwIP_kN6Wuro",
    authDomain: "email-warmup-524f9.firebaseapp.com",
    projectId: "email-warmup-524f9",
    storageBucket: "email-warmup-524f9.firebasestorage.app",
    messagingSenderId: "326187835013",
    appId: "1:326187835013:web:ea15a0308dee606b7713ec"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);

// Export individual Firestore functions
export {
    collection,
    addDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    updateDoc,
    doc,
    getDocs,
    serverTimestamp,
    getDoc
} from 'firebase/firestore';

// FCM Token Management
export const getFCMToken = async () => {
    try {
        const currentToken = await getToken(messaging, {
            vapidKey: "BLablabla..." // Replace with your actual VAPID key
        });
        if (currentToken) {
            console.log('FCM Token:', currentToken);
            return currentToken;
        } else {
            console.log('No registration token available.');
            return null;
        }
    } catch (error) {
        console.error('Error getting FCM token:', error);
        return null;
    }
};

// Request notification permission
export const requestNotificationPermission = async () => {
    try {
        if (!('Notification' in window)) {
            console.log('This browser does not support notifications');
            return null;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            return await getFCMToken();
        } else {
            console.log('Unable to get permission to notify.');
            return null;
        }
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return null;
    }
};

// Listen for foreground messages
export const onForegroundMessage = () => {
    return onMessage(messaging, (payload) => {
        console.log('Received foreground message:', payload);
        if (payload.notification && Notification.permission === 'granted') {
            const { title, body } = payload.notification;
            new Notification(title, {
                body,
                icon: '/favicon.ico',
                tag: 'alert-notification'
            });
        }
    });
};

// Store FCM token for user
export const storeFCMToken = async (userId, token) => {
    try {
        await addDoc(collection(db, 'fcmTokens'), {
            userId,
            token,
            createdAt: serverTimestamp(),
            active: true
        });
        console.log('FCM token stored successfully');
    } catch (error) {
        console.error('Error storing FCM token:', error);
        throw error;
    }
};