import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

// The first screen is the login page (which explains what Spliit is for);
// signed-in users go straight to their groups.
export default async function HomePage() {
  redirect((await getCurrentUser()) ? '/groups' : '/login')
}
