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

export interface CampDay {
  id: number
  dayNo: number
  date: string | null
}

export interface Camp {
  id: number
  name: string
  days: CampDay[]
  waves: Partial<Record<Bracket, string>> // ISO date the bracket's external registration opens
}

export interface CampInput {
  name: string
  days: { dayNo: number; date: string | null }[]
  waves: Partial<Record<Bracket, string>>
}

export interface Photo {
  id: number
  url: string
}

export interface Activity {
  id: number
  name: string
  description: string
  photos: Photo[]
}

export interface ActivityInput {
  name: string
  description: string
}

export interface OfferingInput {
  activityId: number
  dayIds: number[]
  gender: Gender | null
  brackets: Bracket[] | null
  capacity: number | null
  highDemand: boolean
}

export interface OfferingDto extends OfferingInput {
  id: number
}

export interface ParticipantDto {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  gender: Gender | null
  bracket: Bracket | null
  isOrganizer: boolean
}

export interface ParticipantPatch {
  gender?: Gender
  bracket?: Bracket
  isOrganizer?: boolean
}
