// Types of the HTTP API contract, shared by the Worker and the SPA.
import type { Bracket, Gender, Plan, SignupGroup } from '../domain'

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
  waveEnds: Partial<Record<Bracket, string>> // ISO date it closes (informational)
}

export interface CampInput {
  name: string
  days: { dayNo: number; date: string | null }[]
  waves: Partial<Record<Bracket, string>>
  waveEnds: Partial<Record<Bracket, string>>
}

export interface Activity {
  id: number
  name: string
  logoUrl: string | null // one logo per activity, like the BCC app's activity tiles
}

export interface ActivityInput {
  name: string
}

/** Places per signup group, across all youth groups at the camp; null = unlimited. */
export type Capacity = Record<SignupGroup, number | null>

export interface OfferingInput {
  activityId: number
  dayIds: number[]
  gender: Gender | null
  capacity: Capacity
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

/** A participant as others see them (only onboarded participants are listed). */
export interface PersonDto {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  gender: Gender
  bracket: Bracket
}

/** Everything the SPA needs; small enough (~50 people) to fetch whole and resolve on the client. */
export interface CampState {
  camp: Camp
  activities: Activity[]
  offerings: OfferingDto[]
  people: PersonDto[]
  plans: Plan[]
}
