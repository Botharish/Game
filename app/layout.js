import './globals.css';
import { Analytics } from '@vercel/analytics/next';
export const metadata = { title: 'Doodle Club — Draw, guess, repeat.', description: 'A little imagination. A lot of happy accidents. Play the real-time drawing game with friends.' };
export default function RootLayout({ children }) { return <html lang="en"><body>{children}<Analytics /></body></html>; }
