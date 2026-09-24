// Types of the HTTP API contract, shared by the Worker and the SPA.
import type { Bracket, Gender } from '../domain'

export interface Me {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  gender: Gender | null
  bracket: Bracket | null
  isOrganizer: boolean
  onboarded: boolean
}
