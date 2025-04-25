// frontend/src/lib/api.ts
//import { toast } from 'react-hot-toast'; // <<< Ensure this is imported
import axios from 'axios';

// Define the base URL for the API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api';
console.log(`[api.ts] API_BASE_URL configured as: ${API_BASE_URL}`);

// --- Interfaces for API Data Structures ---

// User Authentication
export interface RegisterUserData {
    name: string;
    email: string;
    password?: string;
}

export interface LoginCredentials {
    email: string;
    password?: string;
}

export interface User {
    userId: number;
    name: string;
    email: string;
    role: 'PLAYER' | 'ADMIN' | 'VISITOR';
    teamName?: string | null;
    avatarUrl?: string | null; // <<< ADD THIS LINE
}


// Function to fetch all users for Admin panel
export async function getAllUsersForAdmin(token: string): Promise<User[]> {
    console.log('[api.ts] Calling getAllUsersForAdmin: /admin/users');
    // Corrected Call: Pass options THEN token
    const response = await fetchWithAuth('/admin/users', { method: 'GET' }, token);
    // Check if response is ok before parsing JSON
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new ApiError(errorData?.message || `Request failed with status ${response.status}`, response.status);
    }
    const data = await response.json();
    return data as User[];
}

// DELETE THE DUPLICATE getAllUsersForAdmin function HERE

// Function for Admin to update a user's role
export async function updateUserRoleAdmin(userId: number, newRole: 'PLAYER' | 'VISITOR', token: string): Promise<User> {
    console.log(`[api.ts] Calling updateUserRoleAdmin for user ${userId} to ${newRole}`);
    // Corrected Call: Pass options THEN token
    const response = await fetchWithAuth(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        // fetchWithAuth likely handles Content-Type for JSON body passed below
        body: { role: newRole } // Pass JS object, fetchWithAuth should stringify
    }, token);
    // Check if response is ok before parsing JSON
     if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new ApiError(errorData?.message || `Request failed with status ${response.status}`, response.status);
    }
    const data = await response.json();
    return data as User;
}

export interface AuthResponse {
    token: string;
    user: User;
}

// Rounds and Fixtures
export interface Round {
    roundId: number;
    name: string;
    deadline: string; // ISO date string
    status: 'SETUP' | 'OPEN' | 'CLOSED' | 'COMPLETED';
}

export interface Fixture {
    fixtureId: number;
    roundId: number;
    homeTeam: string; // Use camelCase consistently in frontend interfaces
    awayTeam: string; // Use camelCase consistently in frontend interfaces
    matchTime: string; // ISO date string
    homeScore: number | null; // Use null for consistency
    awayScore: number | null; // Use null for consistency
    status: 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'SUSPENDED' | 'CANCELED'; // Add status from backend
}

// === ADD THIS INTERFACE ===
export interface PotentialFixture {
    externalId: number; // The ID from football-data.org
    homeTeam: string;
    awayTeam: string;
    matchTime: string; // ISO String (UTC from football-data.org)
}
// ==========================


// Predictions
export interface Prediction {
    predictionId?: number;
    userId?: number;
    fixtureId: number;
    roundId?: number;
    predictedHomeGoals: number | null;
    predictedAwayGoals: number | null;
    pointsAwarded?: number | null;
    isJoker?: boolean;
    submittedAt?: string; // ISO date string
}

export interface PredictionPayload {
    fixtureId: number;
    predictedHomeGoals: number | null; // Allow null initially
    predictedAwayGoals: number | null; // Allow null initially
    isJoker?: boolean; // *** MODIFIED: Uncommented for Joker feature ***
}

// Combined type used in Dashboard/ActiveRound fetch
export interface FixtureWithPrediction extends Fixture {
    predictedHomeGoals: number | null; // Use null consistently
    predictedAwayGoals: number | null; // Use null consistently
    isJoker?: boolean; // Already correctly includes isJoker
}


// Response type for GET /rounds/active
export interface ActiveRoundResponse {
    roundId: number;
    name: string;
    deadline: string;
    status: 'SETUP' | 'OPEN' | 'CLOSED' | 'COMPLETED'; // Match Round['status']
    jokerLimit: number;
    fixtures: FixtureWithPrediction[];
}


// Simple types for specific use cases
export interface SimpleRound {
    roundId: number;
    name: string;
}

// --- Add User Prediction History Types ---
export interface UserPredictionRoundInfo {
    roundId: number;
    roundName: string;
    status: string; // e.g., 'OPEN', 'CLOSED', 'COMPLETED'
}

export interface UserPredictionFixtureInfo {
    homeTeam: string;
    awayTeam: string;
    matchTime: string; // ISO Date String
    homeScore: number | null;
    awayScore: number | null;
}

export interface UserPredictionItem {
    predictionId: number;
    fixtureId: number;
    predictedHomeGoals: number;
    predictedAwayGoals: number;
    isJoker: boolean;
    pointsAwarded: number | null;
    fixture: UserPredictionFixtureInfo;
}

export interface UserPredictionResponse {
    roundInfo: UserPredictionRoundInfo | null; // Null if 'current' requested but none open
    predictions: UserPredictionItem[];
}
// --- End User Prediction History Types ---

// ========================================================
// ===== STANDING ENTRY INTERFACE - UPDATED ===============
// ========================================================
export interface StandingEntry {
  rank: number;
  userId: number; // Keep userId for potential key prop or future use
  name: string;
  points: number;
  movement: number | null; // Positive (up), negative (down), or null (no change/first round)
  totalPredictions: number; // 'Pld' column
  correctOutcomes: number; // 'Outcome' column
  exactScores: number; // 'Exact' column
  accuracy: number | null; // Percentage (e.g., 75.5) or null if no predictions
  // --- ADD THESE LINES ---
  teamName?: string | null;  // Optional: User's chosen display name
  avatarUrl?: string | null; // Optional: Relative path to avatar
  // -----------------------
}
// ========================================================
// ========================================================


// --- Admin Specific Interfaces ---

// Payload for creating a round
export interface CreateRoundPayload {
    name: string;
    deadline: string;
    jokerLimit?: number;
}

// Payload for updating round status
export interface UpdateRoundStatusPayload {
    status: 'SETUP' | 'OPEN' | 'CLOSED' ; // Only allow setting these explicitly
}

// --- NEW: Payload for updating round details (name, deadline) ---
export interface UpdateRoundPayload {
    name?: string;     // Optional: Only send if changed
    deadline?: string; // Optional: Only send if changed. Expecting ISO or datetime-local string
}


// Payload for adding a single fixture manually
export interface AddFixturePayload {
    homeTeam: string; // Use camelCase
    awayTeam: string; // Use camelCase
    matchTime: string; // Expecting ISO format string
}

/**
 * Type definition for the payload when submitting fixture results.
 */
export interface ResultPayload {
    homeScore: number; // Use camelCase
    awayScore: number; // Use camelCase
}

// Payload for importing fixtures
export interface ImportFixturesPayload {
    roundId: number;
    competitionCode: string; // e.g., 'PL' for Premier League
    matchday: number | string; // e.g., 1 or '1'
}

// Response type for importing fixtures
export interface ImportFixturesResponse { // Keep this defined if used elsewhere
    message: string;
    count: number;
}

// --- NEW: Admin Audit Specific Interfaces ---

export interface AdminUserSelectItem {
    userId: number;
    name: string;
}

export interface AdminPredictionDetail {
    fixtureId: number;
    predictedHomeGoals: number | null;
    predictedAwayGoals: number | null;
    isJoker: boolean;
    pointsAwarded: number | null;
    fixture: { // Nested fixture data
        homeTeam: string;
        awayTeam: string;
        homeScore: number | null;
        awayScore: number | null;
        matchTime: string; // ISO Date string
    };
}

// --- Add Friend Related Types ---

// Basic user info for displaying friends or requesters
export interface FriendUser {
    userId: number;
    name: string;
    avatarUrl?: string | null;
}

// Represents an incoming friend request
export interface PendingFriendRequest {
    id: number; // ID of the Friendship record itself
    requesterId: number;
    addresseeId: number;
    status: 'PENDING'; // Explicitly PENDING
    createdAt: string; // ISO Date string
    requester: FriendUser; // Details of the user who sent the request
}

// Simple message response type for actions
interface FriendActionResponse {
  message: string;
  // Optionally include updated friendship record if needed by UI
  // friendship?: { id: number, status: string, ... };
}

// --- END: Admin Audit Specific Interfaces ---

// --- NEW: Round Summary Interfaces ---

export interface RoundSummaryStats {
    exactScoresCount: number;
    successfulJokersCount: number;
    totalPredictions: number;
    // totalPointsScored?: number; // Optional if we add it back later
}

export interface RoundTopScorer {
    userId: number | null; // Allow null just in case ID is missing
    name: string;
    points: number;
}

export interface OverallLeader {
    userId: number | null;
    name: string;
    totalPoints: number;
}

export interface TopJokerPlayer {
    userId: number | null;
    name: string;
    successfulJokers: number;
}

export interface RoundSummaryResponse {
    roundId: number;
    roundName: string;
    roundStats: RoundSummaryStats;
    topScorersThisRound: RoundTopScorer[];
    overallLeaders: OverallLeader[];
    topJokerPlayers: TopJokerPlayer[];
}

// --- END: Round Summary Interfaces ---

// Add NewsItem Type
export interface NewsItem {
    newsItemId: number;
    content: string;
    createdAt: string; // ISO Date String
    postedBy?: { // Make postedBy optional in case relation was optional
        name: string;
    } | null; // Can be null if relation is optional
}

// --- Add Prediction Status Type ---
export interface PlayerPredictionStatus {
    userId: number;
    name: string;
    avatarUrl?: string | null;
    hasPredicted: boolean;
}

// --- Custom API Error Class ---
export class ApiError extends Error {
    status: number;
    data?: unknown; // <<< CHANGED 'any' TO 'unknown'

    constructor(message: string, status: number, data?: unknown) { // <<< CHANGED 'any' TO 'unknown'
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ApiError);
        }
    }
}

interface HighlightLeader {
    userId: number;
    name: string;
    avatarUrl?: string | null;
    totalPoints: number; // For overall leader
}

interface HighlightTopScorer {
    userId: number;
    name: string;
    avatarUrl?: string | null;
    score: number; // Score for the specific round
}

export interface DashboardHighlightsResponse {
    lastRoundHighlights: {
        roundId: number;
        roundName: string;
        topScorers: HighlightTopScorer[];
    } | null;
    userLastRoundStats: {
        roundId: number;
        score: number;
        rank: number;
    } | null;
    overallLeader: {
        leaders: HighlightLeader[];
        leadingScore: number;
    } | null;
}

// Type for the response from the fetch results endpoint
interface FetchResultsResponse {
    message: string;
    updatedCount: number;
}

// --- Add User Prediction Stats Types ---
interface BestRoundInfo {
    roundId: number;
    roundName: string;
    points: number;
}

interface PointsHistory {
    roundId: number;
    roundName: string;
    points: number;
}

export interface UserPredictionStatsResponse {
    overallAccuracy: number; // e.g., 0.65 for 65%
    averagePointsPerRound: number;
    bestRound: BestRoundInfo | null;
    pointsPerRoundHistory: PointsHistory[];
}
// --- End User Prediction Stats Types ---

// --- Add League Related Types ---

export interface LeagueCreatorInfo {
    userId: number;
    name: string;
}

export interface LeagueMemberInfo { // Info needed for displaying member list
    userId: number;
    role: 'ADMIN' | 'MEMBER'; // Role within the league
    joinedAt: string; // ISO Date string
    user: FriendUser; // Reuse FriendUser for basic details (id, name, avatar)
}

// Type for the response when getting details for ONE league
export interface LeagueDetailsResponse {
    leagueId: number;
    name: string;
    description?: string | null;
    inviteCode?: string | null; // Only present for league admins
    createdAt: string; // ISO Date string
    creator: LeagueCreatorInfo;
    memberships: LeagueMembership[];
}

// Type for the response when getting the list of leagues the user is in
export interface MyLeagueInfo {
    leagueId: number;
    name: string;
    description?: string | null;
    inviteCode?: string | null; // May or may not be present based on backend logic for list view
    creator: LeagueCreatorInfo;
    myLeagueRole: 'ADMIN' | 'MEMBER'; // User's role in this specific league
    // Optionally add member count if backend provides it: memberCount?: number;
}

// Type for response after joining a league
export interface JoinLeagueResponse {
    message: string;
    membership: {
        membershipId: number;
        role: 'MEMBER'; // Should always be MEMBER when joining
        joinedAt: string;
        league: {
            leagueId: number;
            name: string;
        }
    }
}

// Interface for basic League info
export interface LeagueBaseInfo {
    leagueId: number;
    name: string;
    description?: string | null;
    creator?: FriendUser; // Use your FriendUser type
}

// Update/Define LeagueMembership to match backend + add status/invite fields
export interface LeagueMembership {
    membershipId: number;
    leagueId: number;
    userId: number;
    role: 'ADMIN' | 'MEMBER';
    status: 'ACCEPTED' | 'INVITED'; // <<< ADDED status
    joinedAt?: string | null;      // <<< Ensure optional (ISO Date string)
    invitedAt?: string | null;     // <<< ADDED invitedAt (ISO Date string)
    user?: FriendUser;             // User details (if included)
    league?: LeagueBaseInfo;       // League details (if included)
}

// Type specifically for Pending Invites list items (ensures nested league is present)
export interface PendingLeagueInvite extends LeagueMembership {
    status: 'INVITED'; // Explicitly INVITED
    league: LeagueBaseInfo & { // Ensure league details are present
        creator: FriendUser; // Ensure creator info is included
    };
}

// Payload for inviting friends
export interface InviteFriendsPayload {
    userIds: number[];
}

// Response after inviting friends
export interface InviteFriendsResponse {
    message: string;
    count: number;
}

// Response after accepting an invite
export interface AcceptInviteResponse {
    message: string;
    membership: LeagueMembership; // The updated membership record
}
// --- End League Membership & Invite Types ---

// Type for response after creating a league
// Backend currently returns: { leagueId, name, description, inviteCode, createdAt }
// Let's create a matching type
export interface CreateLeagueResponse {
     leagueId: number;
     name: string;
     description?: string | null;
     inviteCode?: string | null;
     createdAt: string; // ISO Date string
}

// Response type for regeneration
interface RegenerateCodeResponse {
    message: string;
    inviteCode: string; // The NEW invite code
}

// Type for the verification response
interface VerificationResponse {
    success: boolean;
    message: string;
}

// --- End Custom API Error Class ---

// --- Helper Function ---

/**
 * A wrapper around fetch that automatically adds the Authorization header
 * and handles common error scenarios using the Headers object API.
 * Handles JSON bodies and FormData bodies correctly regarding Content-Type.
 * NOTE: This helper *returns the Response object* on success, requires manual .json() parsing.
 * It throws an instance of ApiError on non-ok responses.
 */
// Define a type that extends RequestInit but allows 'body' to be an object too
type FetchOptions = Omit<RequestInit, 'body'> & {
    body?: BodyInit | Record<string, unknown> | null; // Allow standard BodyInit OR a plain object
};




const fetchWithAuth = async (
    url: string,
    options: FetchOptions = {},
    token: string | null // Linter incorrectly flags this, but it's used below
): Promise<Response> => {
   // ...
   const headers = new Headers(options.headers);
   // ...

   // --- ADD THIS BLOCK BACK ---
   // Add Authorization header if token exists
   if (token) { // <<< Use the token parameter
    headers.set('Authorization', `Bearer ${token}`);
}
// --- END OF BLOCK TO ADD ---

   // Adjust internal body type to match FetchOptions
   let body: BodyInit | (object & { [key: string]: unknown }) | null | undefined = options.body;

   // --- Content-Type and Body Handling ---
   // The check needs to verify it's an object but NOT a standard BodyInit type
   // This is slightly complex, let's simplify the check:
   // If it's not FormData and it IS an object (and not null/undefined), treat it as JSON candidate.
   if (!(body instanceof FormData) && typeof body === 'object' && body !== null) {

       // If it's Blob, BufferSource, URLSearchParams, ReadableStream - it's BodyInit, do nothing here
       // This check might be imperfect but covers common cases.
       const isStandardBodyInitObject = body instanceof Blob ||
                                       ArrayBuffer.isView(body) || // TypedArrays, DataView
                                       body instanceof ArrayBuffer ||
                                       body instanceof URLSearchParams ||
                                       'pipe' in body; // Duck-typing for ReadableStream

       if (!isStandardBodyInitObject) { // It's likely our plain JS object
           if (!headers.has('Content-Type')) {
               headers.set('Content-Type', 'application/json');
           }
           if (headers.get('Content-Type')?.includes('application/json')) {
               try {
                   body = JSON.stringify(body); // Stringify our plain object
               } catch (error) {
                   console.error("[fetchWithAuth] Failed to stringify request body:", error);
                   throw new Error("Failed to process request data before sending.");
               }
           }
       }
       // If it WAS a standard BodyInit object (like Blob), it passes through without stringification
   }
   // --- End Content-Type and Body Handling ---

    console.log(`[fetchWithAuth] Request: ${options.method || 'GET'} ${url}`);

    const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options, // Spread original options
        headers: headers,
        // Cast 'body' back to BodyInit as that's what fetch expects after our potential stringification
        body: body as BodyInit | null | undefined,
    });

     console.log(`[fetchWithAuth] Response Status for ${url}: ${response.status}`);

     if (!response.ok) {
        // Initialize errorMessage with the base message
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        // Initialize errorData as null, will be reassigned if JSON parsing succeeds
        let errorData: unknown = null;

        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                errorData = await response.json(); // Assign parsed JSON here
                if (typeof errorData === 'object' && errorData !== null && 'message' in errorData && typeof (errorData as {message: unknown}).message === 'string') {
                    errorMessage = (errorData as {message: string}).message; // Reassign errorMessage
                } else {
                    errorMessage = `${errorMessage} (Received JSON error object)`; // Reassign errorMessage
                }
                console.error(`[fetchWithAuth] API Error Response (${response.status}) for ${url}:`, errorData);
            } else {
                const textError = await response.text();
                console.error(`[fetchWithAuth] API Error Response (${response.status}) for ${url} (non-JSON):`, textError);
                if (textError) {
                    errorMessage = `${errorMessage} - ${textError.substring(0, 150)}`; // Reassign errorMessage
                }
            }
        } catch (parseError) { // <<< Catch block
            // Use the parseError variable in the log message
            console.error(`[fetchWithAuth] Error parsing error response body for ${url}:`, parseError); // <<< USED parseError
        }

        // Throw the custom ApiError with potentially updated errorMessage and errorData
        throw new ApiError(errorMessage, response.status, errorData);
     }

    return response;
};

// --- Helper Function for Case Mapping ---
// Simple snake_case to camelCase converter for object keys
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCamelCase = <T>(obj: any): T => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
        return obj; // Return non-objects or arrays as is
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const newKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
            newObj[newKey] = toCamelCase(obj[key]); // Recursively map nested objects
        }
    }
    return newObj as T;
};

// Helper to map an array of objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapArrayToCamelCase = <T>(arr: any[]): T[] => {
     if (!Array.isArray(arr)) {
        console.warn("mapArrayToCamelCase received non-array:", arr);
        return []; // Return empty array if input is not an array
     }
     // Ensure each item is recursively mapped
     return arr.map(item => toCamelCase<T>(item));
};


// --- API Functions ---

// == User Facing Functions ==

/**
 * Registers a new user.
 */
export const registerUser = async (userData: RegisterUserData): Promise<void> => {
    await fetchWithAuth('/auth/register', {
        method: 'POST',
        body: userData as unknown as BodyInit // <<< Add 'as BodyInit'
    }, null);
};

/**
 * Logs in a user. Backend should return camelCase AuthResponse.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await fetchWithAuth('/auth/login', {
        method: 'POST',
        body: credentials as unknown as BodyInit // <<< Add 'as BodyInit'
    }, null);
    const data = await response.json();
    return data as AuthResponse;
};

/**
 * Fetches the currently active round ('OPEN' status), its fixtures, and the logged-in user's predictions.
 * Backend /rounds/active already provides mapped camelCase response.
 */
export const getActiveRound = async (token: string): Promise<ActiveRoundResponse | null> => {
    try {
        const response = await fetchWithAuth('/rounds/active', { method: 'GET' }, token);
        if (response.status === 204 || response.headers.get('content-length') === '0') {
            return null;
        }
        const data = await response.json();
        if (!data) return null;

        // Backend already maps to camelCase for this specific route
        // Type assertion is safe if backend contract is maintained
        return data as ActiveRoundResponse;
    } catch (error) {
         if (error instanceof Error && error.message.includes('404')) {
             console.log("No active round found (404).");
             return null;
         }
         console.error("Error in getActiveRound:", error);
         throw error; // Re-throw to allow calling components to handle it
     }
};


/**
 * Saves/updates user predictions for the active round.
 * Expects an array of prediction objects (camelCase).
 * Sends camelCase payload to the backend.
 */
export const savePredictions = async (predictions: PredictionPayload[], token: string): Promise<void> => {
    const payload = {
        predictions: predictions // The outer object is the one to pass
    };
    await fetchWithAuth('/predictions', {
        method: 'POST',
        body: payload, // <<< Pass the raw payload object
    }, token);
};

// ========================================================
// ===== NEW FUNCTION: Generate Random Predictions ========
// ========================================================
/**
 * Calls the backend to generate random predictions for the user for the active round.
 * @param token - The user's authentication token.
 * @returns A promise resolving to an object with message and count.
 */
export const generateRandomUserPredictions = async (token: string): Promise<{ message: string; count: number }> => {
    const url = '/predictions/random'; // The new endpoint path
    console.log(`%c[api.ts] Calling generateRandomUserPredictions: ${url}`, 'color: magenta;');

    if (!token) {
        console.error('%c[generateRandomUserPredictions] No token provided!', 'color: red;');
        throw new Error("Authentication token is missing.");
    }

    try {
        // Using POST method as defined in the backend route
        const response = await fetchWithAuth(url, { method: 'POST' }, token);
        console.log(`%c[generateRandomUserPredictions] fetchWithAuth successful`, 'color: magenta;');

        const responseData = await response.json(); // Expect { message, count }

        // Basic validation of the response structure
        if (!responseData || typeof responseData.message !== 'string' || typeof responseData.count !== 'number') {
            console.error('%c[generateRandomUserPredictions] Invalid response format:', 'color: red;', responseData);
            throw new Error("Received invalid data format from server.");
        }

        console.log(`%c[generateRandomUserPredictions] Success response:`, 'color: magenta;', responseData);
        return responseData; // Return { message, count }

    } catch (error) {
         console.error(`%c[generateRandomUserPredictions] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         // Re-throw the error so the calling component can handle it (e.g., show toast)
         // If error is already an Error object, rethrow it, otherwise create a new one
         if (error instanceof Error) {
            throw error;
         } else {
            // Fallback for non-Error exceptions
            throw new Error('An unknown error occurred while generating random predictions.');
         }
    }
};
// ========================================================

// --- NEW Profile Function ---

/**
 * Sets or updates the logged-in user's team name.
 * @param teamName The new team name (string). Sending an empty string "" should clear it.
 * @param token User's authentication token.
 * @returns Promise resolving to the updated User object (excluding passwordHash).
 */
export const setTeamName = async (teamName: string, token: string): Promise<User> => {
    const url = '/users/profile/team-name';
    const payload = { teamName: teamName }; // Create the object
    const response = await fetchWithAuth(url, {
        method: 'POST',
        body: payload // <<< Pass the raw object
    }, token);
    const updatedUserData = await response.json();
    return updatedUserData as User;
};

// --- END NEW Profile Function ---

// --- NEW Avatar Upload Function ---

/**
 * Uploads the user's avatar image.
 * @param file - The image File object to upload.
 * @param token - The user's authentication token.
 * @returns The updated User object from the backend.
 * @throws Will throw an ApiError if the fetch fails or the API returns an error.
 */
export const uploadAvatar = async (file: File, token: string): Promise<User> => {
    const url = '/users/profile/avatar'; // Matches backend POST route
    console.log(`%c[api.ts] Calling uploadAvatar: ${url}`, 'color: blueviolet;', { name: file.name, size: file.size, type: file.type });

    if (!token) {
        console.error('%c[uploadAvatar] Authentication token is missing!', 'color: red;');
        throw new ApiError("Authentication token is missing.", 401); // Use ApiError
    }
    if (!file) {
        console.error('%c[uploadAvatar] No file provided!', 'color: red;');
        throw new ApiError("No file selected for upload.", 400); // Use ApiError
    }

    // --- Create FormData ---
    const formData = new FormData();
    // The key 'avatar' MUST match the name used in the backend:
    // backend/middleware/uploadMiddleware.js -> uploadAvatar.single('avatar')
    // backend/routes/users.js -> router.post('/profile/avatar', uploadAvatar.single('avatar'), ...)
    formData.append('avatar', file);
    // --------------------

    try {
        const response = await fetchWithAuth(
            url,
            {
                method: 'POST',
                body: formData,
                // DO NOT manually set 'Content-Type': 'multipart/form-data' here!
                // fetchWithAuth and the browser handle this automatically for FormData.
            },
            token
        );
        console.log(`%c[uploadAvatar] fetchWithAuth successful`, 'color: blueviolet;');

        // Expect backend to return the updated User object on success
        const updatedUser: User = await response.json();

        // Simple validation of the response structure
        if (!updatedUser || typeof updatedUser.userId !== 'number' || !updatedUser.email) {
             console.error('%c[uploadAvatar] Invalid response format received:', 'color: red;', updatedUser);
             // Throw an error indicating unexpected response from server
             throw new ApiError("Received invalid user data format from server after avatar upload.", 500); // Or appropriate status
         }

        console.log(`%c[uploadAvatar] Success response (updated user):`, 'color: blueviolet;', updatedUser);
        return updatedUser; // Return the updated user data

    } catch (error) {
        console.error(`%c[uploadAvatar] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);

        // Check if it's already an ApiError, otherwise wrap it
        if (error instanceof ApiError) {
            throw error; // Re-throw the specific ApiError
        } else if (error instanceof Error) {
            // Wrap other errors (like network errors) in a generic ApiError
             throw new ApiError(`An unexpected error occurred during avatar upload: ${error.message}`, 500);
        } else {
             // Fallback for non-Error throws
             throw new ApiError('An unknown error occurred during avatar upload.', 500);
        }
    }
};

// --- END NEW Avatar Upload Function ---

/**
 * Fetches a list of completed rounds (for standings dropdown).
 * Uses getRounds which maps response to camelCase.
 */
export const getCompletedRounds = async (token: string): Promise<SimpleRound[]> => {
    const completedRounds: Round[] = await getRounds(token, 'COMPLETED');
    return completedRounds.map(({ roundId, name }) => ({ roundId, name }));
};

// --- NEW: Get Latest Completed Round ---
/**
 * Fetches the ID and name of the most recently completed round.
 * Returns null if no rounds are completed yet.
 * @param token User's authentication token.
 */
export const getLatestCompletedRound = async (token: string): Promise<SimpleRound | null> => {
    const url = '/rounds/latest-completed';
    console.log(`%c[api.ts] Calling getLatestCompletedRound: ${url}`, 'color: orange;');
    if (!token) throw new Error("Authentication token is missing.");
    try {
        const response = await fetchWithAuth(url, { method: 'GET' }, token);
        // Check for 204 No Content specifically
        if (response.status === 204) {
            console.log(`%c[getLatestCompletedRound] No completed rounds found (204).`, 'color: orange;');
            return null; // Return null explicitly
        }
        const data = await response.json(); // Expect { roundId, name }
        if (!data || typeof data.roundId !== 'number') {
             console.error('%c[getLatestCompletedRound] Invalid response format:', 'color: red;', data);
             throw new Error("Received invalid data format for latest completed round.");
         }
        console.log(`%c[getLatestCompletedRound] Success response:`, 'color: orange;', data);
        return data as SimpleRound;
    } catch (error) {
         console.error(`%c[getLatestCompletedRound] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         // Don't re-throw, return null if error occurs (e.g., backend issue)
         // Calling component should handle null state.
         // if (error instanceof Error) { throw error; }
         // else { throw new Error('An unknown error occurred fetching latest completed round.'); }
         return null; // Return null on error
    }
};
// --- END NEW FUNCTION ---

/**
 * Fetches the standings for a specific completed round or overall standings.
 * Assumes backend returns camelCase for standings.
 * Pass undefined or null for roundId to get overall standings.
 */
export const getStandings = async (token: string, roundId?: number | null): Promise<StandingEntry[]> => {
    const url = roundId ? `/standings?roundId=${roundId}` : '/standings';
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json();

    // Backend standings endpoint now provides camelCase response directly.
     if (!Array.isArray(rawData)) {
         console.error(`API Error: GET ${url} did not return an array. Response:`, rawData);
         return []; // Return empty array on unexpected response format
     }
    // Type assertion is safe if backend contract is maintained
    // Note: The type returned now includes the new fields defined in StandingEntry
    return rawData as StandingEntry[];
};


// == Admin Functions ==

/**
 * Fetches a list of rounds (Admin). Can optionally filter by status.
 * Backend GET /rounds returns snake_case, so map response here.
 */
export const getRounds = async (token: string, status?: Round['status']): Promise<Round[]> => {
    const url = status ? `/rounds?status=${status}` : '/rounds';
    const response = await fetchWithAuth(url, { method: 'GET' }, token);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error("API Error: GET /rounds (admin) did not return an array. Response:", rawData);
        return [];
    }
    // Map snake_case from backend to camelCase
    return mapArrayToCamelCase<Round>(rawData);
};

/**
 * Creates a new round (Admin).
 * Sends camelCase payload, backend POST /rounds handles it (assumed).
 * Backend returns snake_case, so map response here.
 */
export const createRound = async (roundData: CreateRoundPayload, token: string): Promise<Round> => {
    const response = await fetchWithAuth('/rounds', {
        method: 'POST',
        body: roundData as unknown as BodyInit // Sending payload as is (name, deadline)
    }, token);
    const createdRaw = await response.json();
    // Map snake_case response to camelCase
    return toCamelCase<Round>(createdRaw);
};

/**
 * Updates the status of a specific round (Admin).
 * Sends camelCase payload { status: '...' }. Backend returns nothing (204).
 */
export const updateRoundStatus = async (roundId: number, payload: UpdateRoundStatusPayload, token: string): Promise<void> => {
    await fetchWithAuth(`/rounds/${roundId}/status`, {
        method: 'PUT',
        body: payload as unknown as BodyInit,
    }, token);
     // No return value expected on success
};

// --- NEW: Function to update round details (name, deadline) ---
/**
 * Updates the details (name, deadline) of a specific round (Admin).
 * Sends camelCase payload. Backend returns updated round in snake_case.
 */
export const updateRoundDetails = async (roundId: number, payload: UpdateRoundPayload, token: string): Promise<Round> => {
    const endpoint = `/rounds/${roundId}`; // Target the specific round ID with PUT
    const response = await fetchWithAuth(endpoint, {
        method: 'PUT',
        // Pass raw payload object + assertion
        body: payload as unknown as BodyInit // <<< CHANGED
    }, token);

    // Check if the response includes content before trying to parse JSON
    if (response.status === 204 || !response.headers.get('content-type')?.includes('application/json')) {
        console.warn(`Update round details for ID ${roundId} returned status ${response.status} or non-JSON content.`);
        // Consider how best to handle 204 No Content - maybe fetch the updated round separately?
        // For now, throwing an error might be disruptive if the update *did* succeed.
        // Returning a specific indicator or fetching again might be better UX long-term.
        // Let's modify the error slightly to be less alarming if it was a 204.
        if (response.status === 204) {
             console.log(`Round ${roundId} details updated (Status 204). Fetching updated data...`);
             // Example: Fetch all rounds again and find the updated one
             // This might not be efficient if you have many rounds.
             // A dedicated GET /rounds/:id endpoint would be better.
             // For now, just returning the original payload as a placeholder if needed
             // Or throwing a less severe error/indicator.
             // Let's return a modified Round object based on payload as a temporary measure
             // WARNING: This won't have potentially updated timestamps from the backend.
             const existingRounds = await getRounds(token); // Assuming getRounds is efficient enough
             const updatedRound = existingRounds.find(r => r.roundId === roundId);
             if (updatedRound) return updatedRound; // Return the re-fetched round
             else throw new Error(`Round ${roundId} updated (Status 204), but failed to re-fetch details.`);

        } else {
             throw new Error(`Round update responded with status ${response.status} and unexpected content type.`);
        }
    }

    // If response has JSON content (e.g., status 200)
    const updatedRaw = await response.json();
    // Map snake_case response from backend to camelCase
    return toCamelCase<Round>(updatedRaw);
};


/**
 * Fetches all fixtures for a specific round (Admin).
 * Backend GET /rounds/:id/fixtures returns snake_case, so map response here.
 */
export const getRoundFixtures = async (roundId: number, token: string): Promise<Fixture[]> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, { method: 'GET' }, token);
    const rawData = await response.json();

    if (!Array.isArray(rawData)) {
        console.error(`API Error: GET /rounds/${roundId}/fixtures did not return an array. Response:`, rawData);
        return [];
    }
     // Map snake_case array from backend to camelCase
    return mapArrayToCamelCase<Fixture>(rawData);
};


/**
 * Adds a new fixture to a specific round (Admin).
 * Sends camelCase payload.
 * Backend POST /rounds/:id/fixtures returns snake_case, so map response here.
 */
export const addFixture = async (roundId: number, fixtureData: AddFixturePayload, token: string): Promise<Fixture> => {
    const response = await fetchWithAuth(`/rounds/${roundId}/fixtures`, {
        method: 'POST',
        // Pass raw fixtureData object + assertion
        body: fixtureData as unknown as BodyInit, // <<< CHANGED
    }, token);

    // Expect 201 Created with the created fixture in the body
    if (response.status !== 201) {
         // Handle other potential errors (e.g., 400 Bad Request, 404 Round Not Found, 500 Server Error)
         let errorMessage = `Failed to add fixture, received status ${response.status}`;
         try {
             const errorData = await response.json();
             errorMessage = errorData?.message || errorMessage;
         } catch { /* Ignore if body isn't JSON */ }
         throw new ApiError(errorMessage, response.status); // Use ApiError if possible
    }

    // Check content type before parsing JSON
     if (!response.headers.get('content-type')?.includes('application/json')) {
         console.warn(`Add fixture responded with status 201 but non-JSON content.`);
         // If backend guarantees 201 always returns JSON, this is an error state
         throw new ApiError('Fixture added, but confirmation data has unexpected format.', 201);
     }

    const createdRaw = await response.json();
    // Map snake_case response to camelCase
    return toCamelCase<Fixture>(createdRaw);
};

/**
 * Deletes a specific fixture and its associated predictions (Admin).
 */
export const deleteFixture = async (fixtureId: number, token: string): Promise<void> => {
    const endpoint = `/fixtures/${fixtureId}`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);
        if (response.status !== 204) { // Expect 204 No Content on successful DELETE
            console.warn(`Delete fixture responded with unexpected status: ${response.status}`);
            let body = ''; try { body = await response.text(); } catch {}
            throw new Error(`Delete fixture responded with status ${response.status}: ${body}`);
        }
         // No return needed on success
    } catch (error: unknown) {
        console.error(`Error deleting fixture ${fixtureId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while deleting the fixture.'); }
    }
};

/**
 * Submits the result for a specific fixture.
 * Sends camelCase payload.
 * Backend PUT /fixtures/:id/result returns snake_case, so map response here.
 */
export const enterFixtureResult = async (fixtureId: number, payload: ResultPayload, token: string): Promise<Fixture> => {
    const endpoint = `/fixtures/${fixtureId}/result`;
    try {
        // Pass the raw payload object, but assert its type for fetchWithAuth
        const response = await fetchWithAuth(
            endpoint,
            {
                method: 'PUT',
                // <<< ADD Type Assertion Here >>>
                body: payload as unknown as Record<string, unknown>
            },
            token
        );
        // PUT often returns 200 OK with the updated resource, or 204 No Content
        if (response.status === 204) {
             console.warn("Fixture result updated successfully, but no updated data was returned (Status 204).");
             // Might need to fetch the fixture again if UI needs updated data immediately
             throw new Error("Fixture result updated, but no confirmation data received (Status 204). Refresh may be needed.");
         }
        if (response.headers.get('content-type')?.includes('application/json')) {
             const updatedRaw = await response.json();
             return toCamelCase<Fixture>(updatedRaw); // Map snake_case response
        }
        // Handle unexpected response (e.g., 200 OK but no JSON)
        throw new Error(`Fixture result update responded with status ${response.status} but unexpected content type.`);
    } catch (error: unknown) {
        console.error(`Error submitting result for fixture ${fixtureId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while submitting the fixture result.'); }
    }
};

/**
 * Triggers the scoring process for a specific CLOSED round (Admin).
 * Backend returns nothing (200 OK or 202 Accepted typically).
 */
export const triggerScoring = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}/score`;
    try {
        // Assume backend returns 200 or 202 on success, no body needed
        await fetchWithAuth(endpoint, { method: 'POST' }, token);
        console.log(`Scoring triggered successfully for round ${roundId}`);
    } catch (error: unknown) {
        console.error(`Error triggering scoring for round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while triggering scoring.'); }
    }
};

/**
 * Imports fixtures for a specific round from an external API (Admin).
 * Sends camelCase payload.
 * Backend POST /rounds/import/fixtures returns camelCase directly.
 */
export const importFixtures = async (payload: ImportFixturesPayload, token: string): Promise<{ message: string; count: number }> => {
    const endpoint = '/rounds/import/fixtures';
    try {
        const response = await fetchWithAuth(endpoint, {
            method: 'POST',
            // Pass raw payload object + assertion
            body: payload as unknown as BodyInit // <<< CHANGED
        }, token);

        // Check for successful status codes (200 OK or 201 Created)
        if (response.ok) { // Handles 200-299 range
            // Ensure response is JSON before parsing
            if (response.headers.get('content-type')?.includes('application/json')) {
                 const responseData = await response.json();
                 // Optional: Add basic validation for responseData structure
                 if (responseData && typeof responseData.message === 'string' && typeof responseData.count === 'number') {
                     return responseData;
                 } else {
                      console.error('Import fixtures successful, but response format is invalid:', responseData);
                      throw new ApiError('Fixture import succeeded but received invalid confirmation data.', response.status);
                 }
            } else {
                 console.warn(`Import fixtures responded with status ${response.status} but non-JSON content.`);
                 // Decide how to handle success without expected JSON body (e.g., return default message or throw)
                 throw new ApiError(`Fixture import status ${response.status} ok, but confirmation data format is incorrect.`, response.status);
            }
        } else {
            // Handle non-ok responses
            let errorMessage = `Fixture import failed with status ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData?.message || errorMessage;
            } catch { /* ignore */ }
            throw new ApiError(errorMessage, response.status);
        }
    } catch (error: unknown) {
        // Catch fetch errors or errors thrown from response handling
        console.error(`Error importing fixtures for round ${payload.roundId}:`, error);
         if (error instanceof ApiError || error instanceof Error) { throw error; }
         else { throw new Error('An unknown error occurred while importing fixtures.'); }
    }
};

/**
 * Triggers the generation of random results for all fixtures in a given round (Admin).
 * Backend POST /rounds/:id/fixtures/random-results returns camelCase directly.
 */
export const generateRandomResults = async (roundId: number, token: string): Promise<{ message: string; count: number }> => {
    const endpoint = `/rounds/${roundId}/fixtures/random-results`;
    try {
        // POST request typically implies sending data, but this one might not need a body.
        // If it requires a body (even an empty one), add body: {} as unknown as BodyInit
        // Assuming no body is needed for this specific POST based on previous logic:
        const response = await fetchWithAuth(endpoint, { method: 'POST' }, token);

        // Check for successful status codes
        if (response.ok) { // Handles 200-299 range
             // Ensure response is JSON before parsing
             if (response.headers.get('content-type')?.includes('application/json')) {
                 const responseData = await response.json();
                 // Optional: Add basic validation for responseData structure
                 if (responseData && typeof responseData.message === 'string' && typeof responseData.count === 'number') {
                     return responseData;
                 } else {
                     console.error('Generate random results successful, but response format is invalid:', responseData);
                     throw new ApiError('Random results generated but received invalid confirmation data.', response.status);
                 }
             } else {
                 console.warn(`Generate random results responded with status ${response.status} but non-JSON content.`);
                 throw new ApiError(`Random results generation status ${response.status} ok, but confirmation data format is incorrect.`, response.status);
             }
        } else {
             // Handle non-ok responses
             let errorMessage = `Failed to generate random results, received status ${response.status}`;
             try {
                 const errorData = await response.json();
                 errorMessage = errorData?.message || errorMessage;
             } catch { /* ignore */ }
             throw new ApiError(errorMessage, response.status);
        }
    } catch (error: unknown) {
        // Catch fetch errors or errors thrown from response handling
        console.error(`Error generating random results for round ${roundId}:`, error);
        if (error instanceof ApiError || error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while generating random results.'); }
    }
};

/**
 * Deletes a specific round and its associated data (Admin).
 */
export const deleteRound = async (roundId: number, token: string): Promise<void> => {
    const endpoint = `/rounds/${roundId}`;
    try {
        const response = await fetchWithAuth(endpoint, { method: 'DELETE' }, token);
        if (response.status !== 204) { // Expect 204 No Content
            console.warn(`Delete round responded with unexpected status: ${response.status}`);
             let body = ''; try { body = await response.text(); } catch {}
             throw new Error(`Delete round responded with status ${response.status}: ${body}`);
        }
         // No return needed
    } catch (error: unknown) {
        console.error(`Error deleting round ${roundId}:`, error);
        if (error instanceof Error) { throw error; }
        else { throw new Error('An unknown error occurred while deleting the round.'); }
    }
};

// === ADD THIS FUNCTION AT THE END OF ADMIN FUNCTIONS ===
/**
 * Fetches potential fixtures from the external API based on competition and date range.
 */
export const fetchExternalFixtures = async (
    token: string,
    competitionCode: string,
    dateFrom: string, // Expect YYYY-MM-DD
    dateTo: string    // Expect YYYY-MM-DD
): Promise<PotentialFixture[]> => {
    const url = '/fixtures/fetch-external'; // Matches backend route
    console.log(`%c[api.ts] Calling fetchExternalFixtures: ${url}`, 'color: cyan;', { competitionCode, dateFrom, dateTo });

    if (!token) throw new Error("Authentication token is missing.");
    if (!competitionCode || !dateFrom || !dateTo) throw new Error("Competition code and date range are required.");

    const payload = { competitionCode, dateFrom, dateTo };

    try {
        const response = await fetchWithAuth(url, {
            method: 'POST',
            body: payload as unknown as BodyInit // Send payload in body
        }, token);
        console.log(`%c[fetchExternalFixtures] fetchWithAuth successful`, 'color: cyan;');

        const data = await response.json(); // Expect backend to return array directly

        if (!Array.isArray(data)) {
            console.error('%c[fetchExternalFixtures] Invalid response format (expected array):', 'color: red;', data);
            throw new Error("Received invalid data format from server.");
        }

        console.log(`%c[fetchExternalFixtures] Success response (count: ${data.length}):`, 'color: cyan;', data);
        // Basic check on first item structure before casting
        if (data.length > 0 && (typeof data[0].externalId !== 'number' || typeof data[0].homeTeam !== 'string')) {
             console.error('%c[fetchExternalFixtures] Response array items have incorrect structure.', 'color: red;', data[0]);
             throw new Error("Received invalid fixture data structure from server.");
         }

        return data as PotentialFixture[]; // Cast to expected type

    } catch (error) {
         console.error(`%c[fetchExternalFixtures] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         // Re-throw the error so the calling component can handle it
         if (error instanceof Error) {
            throw error;
         } else {
            throw new Error('An unknown error occurred while fetching external fixtures.');
         }
    }
};

// === ADD THIS NEW FUNCTION ===
/**
 * Imports selected fixtures (previously fetched) into a specific round.
 */
export const importSelectedFixtures = async (
    token: string,
    roundId: number,
    // Pass only the necessary data for backend insertion
    fixturesToImport: { homeTeam: string; awayTeam: string; matchTime: string }[]
): Promise<{ message: string; count: number }> => {
    const url = `/rounds/${roundId}/import-selected`;
    console.log(`%c[api.ts] Calling importSelectedFixtures for round ${roundId}`, 'color: olive;', { count: fixturesToImport.length });

    if (!token) throw new Error("Authentication token is missing.");
    if (!roundId || isNaN(roundId)) throw new Error("Valid Round ID is required.");
    if (!Array.isArray(fixturesToImport) || fixturesToImport.length === 0) {
        throw new Error("At least one fixture must be provided to import.");
    }

    // --- DEFINE payload object ---
    const payload = { fixturesToImport: fixturesToImport };
    // ---------------------------

    try {
        const response = await fetchWithAuth(url, {
            method: 'POST',
            // Pass raw payload object + assertion
            body: payload as unknown as BodyInit // <<< CHANGED
        }, token);
        console.log(`%c[importSelectedFixtures] fetchWithAuth successful`, 'color: olive;');

        const responseData = await response.json();

        // Validate response structure
        if (!responseData || typeof responseData.message !== 'string' || typeof responseData.count !== 'number') {
             console.error('%c[importSelectedFixtures] Invalid response format:', 'color: red;', responseData);
             throw new Error("Received invalid data format from server after import.");
         }

        console.log(`%c[importSelectedFixtures] Success response:`, 'color: olive;', responseData);
        return responseData;

    } catch (error) {
        console.error(`%c[importSelectedFixtures] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
        throw error; // Re-throw
    }
};

// --- NEW: Admin Audit API Functions ---

/**
 * Fetches a list of all users (ID and Name) for admin selection.
 * Assumes backend returns camelCase directly.
 * @param token Admin user's authentication token.
 * @returns Promise resolving to an array of AdminUserSelectItem.
 */
export const getAdminUserList = async (token: string): Promise<AdminUserSelectItem[]> => {
    const url = '/admin/users'; // Matches backend route GET /api/admin/users
    console.log(`%c[api.ts] Calling getAdminUserList: ${url}`, 'color: purple;');

    if (!token) throw new Error("Authentication token is missing.");

    try {
        const response = await fetchWithAuth(url, { method: 'GET' }, token);
        console.log(`%c[getAdminUserList] fetchWithAuth successful`, 'color: purple;');

        const data = await response.json(); // Expect backend to return array directly (camelCase)

        if (!Array.isArray(data)) {
            console.error('%c[getAdminUserList] Invalid response format (expected array):', 'color: red;', data);
            throw new Error("Received invalid data format from server.");
        }

        // Basic check on first item structure before casting
        if (data.length > 0 && (typeof data[0].userId !== 'number' || typeof data[0].name !== 'string')) {
             console.error('%c[getAdminUserList] Response array items have incorrect structure.', 'color: red;', data[0]);
             throw new Error("Received invalid user data structure from server.");
        }

        console.log(`%c[getAdminUserList] Success response (count: ${data.length})`, 'color: purple;');
        return data as AdminUserSelectItem[]; // Cast to expected type

    } catch (error) {
         console.error(`%c[getAdminUserList] CATCH BLOCK Error:`, 'color: red; font-weight: bold;', error);
         if (error instanceof Error) { throw error; }
         else { throw new Error('An unknown error occurred while fetching the user list.'); }
    }
};


/**
 * Fetches the detailed prediction audit for a specific user and completed round.
 * Assumes backend returns camelCase directly.
 * @param userId The ID of the user to audit.
 * @param roundId The ID of the completed round to audit.
 * @param token Admin user's authentication token.
 * @returns Promise resolving to an array of AdminPredictionDetail.
 */
export const getAdminUserRoundPredictions = async (
    userId: number,
    roundId: number,
    token: string
): Promise<AdminPredictionDetail[]> => {
    // Construct the URL with parameters
    const url = `/admin/users/${userId}/predictions/${roundId}`; // Matches backend route GET /api/admin/users/:userId/predictions/:roundId
    console.log(`%c[api.ts] Calling getAdminUserRoundPredictions: ${url}`, 'color: purple;');

    if (!token) throw new Error("Authentication token is missing.");
    if (!userId || userId <= 0) throw new Error("Invalid User ID provided.");
    if (!roundId || roundId <= 0) throw new Error("Invalid Round ID provided.");

    try {
        const response = await fetchWithAuth(url, { method: 'GET' }, token);
        console.log(`%c[getAdminUserRoundPredictions] fetchWithAuth successful`, 'color: purple;');

        const data = await response.json(); // Expect backend to return array directly (camelCase)

        if (!Array.isArray(data)) {
            console.error('%c[getAdminUserRoundPredictions] Invalid response format (expected array):', 'color: red;', data);
            throw new Error("Received invalid data format from server.");
        }

        // Add more detailed structure check if desired before casting
        if (data.length > 0 && (typeof data[0].fixtureId !== 'number' || typeof data[0].fixture?.homeTeam !== 'string')) {
             console.error('%c[getAdminUserRoundPredictions] Response array items have incorrect structure.', 'color: red;', data[0]);
             throw new Error("Received invalid prediction detail structure from server.");
         }

        console.log(`%c[getAdminUserRoundPredictions] Success response (count: ${data.length})`, 'color: purple;');
        return data as AdminPredictionDetail[]; // Cast to expected type

    } catch (error) {
         console.error(`%c[getAdminUserRoundPredictions] CATCH BLOCK Error for User ${userId}, Round ${roundId}:`, 'color: red; font-weight: bold;', error);
         if (error instanceof Error) { throw error; }
         else { throw new Error('An unknown error occurred while fetching prediction details.'); }
    }
};

// --- NEW: Round Summary API Function ---

/**
 * Fetches the summary statistics for a specific completed round.
 * Assumes backend returns camelCase directly.
 * @param roundId The ID of the completed round.
 * @param token User's authentication token.
 * @returns Promise resolving to RoundSummaryResponse.
 */
export const getRoundSummary = async (
    roundId: number,
    token: string
): Promise<RoundSummaryResponse> => {
    const url = `/rounds/${roundId}/summary`; // Matches backend route
    console.log(`%c[api.ts] Calling getRoundSummary: ${url}`, 'color: teal;');

    if (!token) throw new Error("Authentication token is missing.");
    if (!roundId || roundId <= 0) throw new Error("Invalid Round ID provided.");

    try {
        const response = await fetchWithAuth(url, { method: 'GET' }, token);
        console.log(`%c[getRoundSummary] fetchWithAuth successful`, 'color: teal;');

        const data = await response.json(); // Expect backend to return the full object

        // Add validation checks for the expected structure
        if (!data || typeof data.roundId !== 'number' || !data.roundStats || typeof data.roundStats.exactScoresCount !== 'number') {
            console.error('%c[getRoundSummary] Invalid response format:', 'color: red;', data);
            throw new Error("Received invalid summary data format from server.");
        }

        console.log(`%c[getRoundSummary] Success response for round ${roundId}`, 'color: teal;');
        return data as RoundSummaryResponse; // Cast to expected type

    } catch (error) {
         console.error(`%c[getRoundSummary] CATCH BLOCK Error for Round ${roundId}:`, 'color: red; font-weight: bold;', error);
         if (error instanceof Error) { throw error; }
         else { throw new Error('An unknown error occurred while fetching the round summary.'); }
    }
};



// --- END: Round Summary API Function ---

// --- END: Admin Audit API Functions ---

// --- Development Only Reset Function ---
export const resetGameDataForDev = async (token: string): Promise<{ message: string }> => {
    console.log('Attempting to reset game data (DEV ONLY)...');
    if (!token) throw new Error('Authentication token is required.');

    // Define the expected endpoint URL
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/admin/dev/reset-game-data`;

    try {
        const response = await axios.post(
            apiUrl,
            {}, // Send an empty body for this POST request
            { headers: { Authorization: `Bearer ${token}` } }
        );

        // Check for successful status codes (e.g., 200, 204)
        if (response.status === 200 || response.status === 204) {
             console.log('Game data reset successful:', response.data);
             // Return the message from the backend, or a default one
             return response.data || { message: 'Game data reset successfully.' };
        } else {
             // Handle unexpected successful status codes if necessary
             throw new Error(`Unexpected success status: ${response.status}`);
        }
    } catch (error) {
         console.error('API Error resetting game data:', error);
         // Re-throw specific ApiError or standard Error
         if (axios.isAxiosError(error) && error.response) {
            // Extract message from backend error response if available
            const apiErrorMessage = error.response.data?.message || error.response.statusText || 'Failed to reset data from API';
             throw new ApiError(apiErrorMessage, error.response.status);
         } else if (error instanceof Error) {
             throw error; // Re-throw other types of errors
         } else {
             throw new Error('An unknown error occurred during data reset.');
         }
    }
};
// --- End Development Reset Function ---

/**
 * Deletes a user (Admin only).
 */
/**
 * Deletes a user (Admin only).
 */
export async function deleteUserAdmin(userId: number, token: string): Promise<{ message: string }> {
    // URL construction is correct now (relative to API_BASE_URL which includes /api)
    const url = `${API_BASE_URL}/admin/users/${userId}`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        // --- RESTORE THIS LINE ---
        const response = await axios.delete<{ message: string }>(url, config);
        // --- END RESTORE ---

        return response.data; // This line makes the function return the promised value

    } catch (error) {
        console.error(`API Error deleting user ${userId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to delete user';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches aggregated data for the dashboard highlights section.
 */
export async function getDashboardHighlights(token: string): Promise<DashboardHighlightsResponse> {
    // API_BASE_URL should already include /api
    const url = `${API_BASE_URL}/dashboard/highlights`; // No extra /api
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.get<DashboardHighlightsResponse>(url, config);
        return response.data;
    } catch (error) {
        console.error("API Error fetching dashboard highlights:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load highlights';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches latest news items.
 * @param limit Optional number of items to fetch
 */
export async function getNewsItems(limit: number = 5): Promise<NewsItem[]> {
    // Assumes API_BASE_URL includes /api and the endpoint is public
    const url = `${API_BASE_URL}/news?limit=${limit}`; // No extra /api, add limit param
    // No token needed if public, add config if protected
    // const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        // If public, no config needed for axios.get
        const response = await axios.get<NewsItem[]>(url);
        return response.data;
    } catch (error) {
        console.error("API Error fetching news items:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load news items';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}


// --- Add Admin function to create news ---
/**
 * Creates a new news item (Admin only).
 */
export async function createNewsItemAdmin(content: string, token: string): Promise<NewsItem> {
    // Assumes API_BASE_URL includes /api
    const url = `${API_BASE_URL}/admin/news`; // No extra /api
    const body = { content };
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.post<NewsItem>(url, body, config);
        return response.data;
    } catch (error) {
        console.error("API Error creating news item:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to create news item';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Deletes a news item (Admin only).
 */
export async function deleteNewsItemAdmin(newsItemId: number, token: string): Promise<{ message: string }> {
    // Assumes API_BASE_URL includes /api
    const url = `${API_BASE_URL}/admin/news/${newsItemId}`; // Correct endpoint
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.delete<{ message: string }>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error deleting news item ${newsItemId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to delete news item';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches the prediction submission status for all players for a given round (Admin only).
 */
export async function getPredictionStatusAdmin(roundId: number, token: string): Promise<PlayerPredictionStatus[]> {
    // Assumes API_BASE_URL includes /api
    const url = `${API_BASE_URL}/admin/rounds/${roundId}/prediction-status`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.get<PlayerPredictionStatus[]>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error fetching prediction status for round ${roundId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load prediction status';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches prediction statistics for the logged-in user.
 */
export async function getUserPredictionStats(token: string): Promise<UserPredictionStatsResponse> {
    // Assumes API_BASE_URL includes /api
    const url = `${API_BASE_URL}/users/me/stats/predictions`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.get<UserPredictionStatsResponse>(url, config);
        return response.data;
    } catch (error) {
        console.error("API Error fetching user prediction stats:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load prediction stats';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches the logged-in user's predictions for a specific round.
 * @param roundId The specific round ID or 'current'.
 * @param token Auth token.
 */
export async function getUserPredictionsForRound(roundId: number | 'current', token: string): Promise<UserPredictionResponse> {
    // Assumes API_BASE_URL includes /api
    const url = `${API_BASE_URL}/users/me/predictions/${roundId}`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.get<UserPredictionResponse>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error fetching user predictions for round ${roundId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load predictions for this round';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        // Handle case where 'current' round leads to a 404/specific message if desired
        if (statusCode === 404 && roundId === 'current') {
             // Optionally return a specific structure or re-throw specific error
             return { roundInfo: null, predictions: [] }; // Return empty state
        }
        throw new ApiError(message, statusCode);
    }
}

/**
 * Sends a request to the backend to initiate password reset.
 */
export async function forgotPassword(email: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/auth/forgot-password`; // No extra /api prefix
    try {
        const response = await axios.post<{ message: string }>(url, { email });
        return response.data; // Should contain the generic message
    } catch (error) {
        console.error("API Error requesting password reset:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to request password reset';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Sends the reset token and new password to the backend.
 */
export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/auth/reset-password/${token}`; // No extra /api prefix
    try {
        const response = await axios.post<{ message: string }>(url, { password });
        return response.data; // Should contain success message
    } catch (error) {
        console.error("API Error resetting password:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to reset password';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

// --- Friend API Functions ---

/**
 * Sends a friend request to a user.
 */
export async function sendFriendRequest(addresseeId: number, token: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/friends/requests`; // Mounted under /api/friends
    const body = { addresseeId };
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.post<{ message: string }>(url, body, config);
        return response.data;
    } catch (error) {
        console.error(`API Error sending friend request to ${addresseeId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to send friend request';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Gets incoming pending friend requests for the logged-in user.
 */
export async function getPendingRequests(token: string): Promise<PendingFriendRequest[]> {
    const url = `${API_BASE_URL}/friends/requests/pending`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.get<PendingFriendRequest[]>(url, config);
        return response.data;
    } catch (error) {
        console.error("API Error fetching pending friend requests:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load pending requests';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Accepts a pending friend request.
 */
export async function acceptFriendRequest(requestId: number, token: string): Promise<FriendActionResponse> {
    const url = `${API_BASE_URL}/friends/requests/${requestId}/accept`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        // PATCH request typically doesn't need a body for this action
        const response = await axios.patch<FriendActionResponse>(url, {}, config);
        return response.data;
    } catch (error) {
        console.error(`API Error accepting friend request ${requestId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to accept friend request';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Rejects (deletes) a pending friend request.
 */
export async function rejectFriendRequest(requestId: number, token: string): Promise<FriendActionResponse> {
    const url = `${API_BASE_URL}/friends/requests/${requestId}/reject`; // Assuming PATCH for reject
    // If using DELETE method instead: const response = await axios.delete...
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
         // PATCH request typically doesn't need a body for this action
        const response = await axios.patch<FriendActionResponse>(url, {}, config);
        return response.data;
    } catch (error) {
        console.error(`API Error rejecting friend request ${requestId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to reject friend request';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Gets the list of accepted friends for the logged-in user.
 */
export async function getMyFriends(token: string): Promise<FriendUser[]> {
    const url = `${API_BASE_URL}/friends`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.get<FriendUser[]>(url, config);
        return response.data;
    } catch (error) {
        console.error("API Error fetching friends list:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load friends list';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Removes a friend (unfriend).
 */
export async function removeFriend(friendUserId: number, token: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/friends/${friendUserId}`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.delete<{ message: string }>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error removing friend ${friendUserId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to remove friend';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Searches for users by name or email (excluding self/friends/pending).
 */
export async function searchUsers(query: string, token: string): Promise<FriendUser[]> {
    // Assumes API_BASE_URL includes /api
    // Encode the query parameter to handle special characters
    const encodedQuery = encodeURIComponent(query);
    const url = `${API_BASE_URL}/users/search?query=${encodedQuery}`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.get<FriendUser[]>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error searching users for query "${query}":`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to search users';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Creates a new league. Requires PLAYER role.
 */
export async function createLeague(name: string, description: string | null, token: string): Promise<CreateLeagueResponse> {
    const url = `${API_BASE_URL}/leagues`; // POST /api/leagues
    const body = { name, description };
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.post<CreateLeagueResponse>(url, body, config);
        return response.data;
    } catch (error) {
        console.error(`API Error creating league "${name}":`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to create league';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Gets the list of leagues the currently logged-in user is a member of.
 */
export async function getMyLeagues(token: string): Promise<MyLeagueInfo[]> {
    const url = `${API_BASE_URL}/leagues/my-leagues`; // GET /api/leagues/my-leagues
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.get<MyLeagueInfo[]>(url, config);
        return response.data;
    } catch (error) {
        console.error("API Error fetching user's leagues:", error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load your leagues';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Gets details for a specific league (user must be a member).
 */
export async function getLeagueDetails(leagueId: number, token: string): Promise<LeagueDetailsResponse> {
    const url = `${API_BASE_URL}/leagues/${leagueId}`; // GET /api/leagues/:leagueId
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.get<LeagueDetailsResponse>(url, config);
        return response.data;
    } catch (error) {
        console.error(`API Error fetching details for league ${leagueId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load league details';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Joins a league using an invite code. Requires PLAYER role.
 */
export async function joinLeagueByInviteCode(inviteCode: string, token: string): Promise<JoinLeagueResponse> {
    const url = `${API_BASE_URL}/leagues/join/${inviteCode}`; // POST /api/leagues/join/:inviteCode
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        // POST request often doesn't need a body for this action
        const response = await axios.post<JoinLeagueResponse>(url, {}, config);
        return response.data;
    } catch (error) {
        console.error(`API Error joining league with code ${inviteCode}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to join league';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Fetches the standings specifically for a given league ID.
 * Assumes backend returns camelCase.
 */
export async function getLeagueStandings(leagueId: number, token: string): Promise<StandingEntry[]> {
    const url = `${API_BASE_URL}/leagues/${leagueId}/standings`; // The new league-specific endpoint
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        const response = await axios.get<StandingEntry[]>(url, config);
        // Assuming backend returns the correct StandingEntry[] structure directly (camelCase)
        return response.data || []; // Return data or empty array
    } catch (error) {
        console.error(`API Error fetching standings for league ${leagueId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Could not load league standings';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Removes a member from a league (League Admin only).
 */
export async function removeLeagueMember(leagueId: number, memberUserIdToRemove: number, token: string): Promise<{ message: string }> {
    // DELETE /api/leagues/:leagueId/members/:memberUserId
    const url = `${API_BASE_URL}/leagues/${leagueId}/members/${memberUserIdToRemove}`;
    const config = {
        headers: { Authorization: `Bearer ${token}` },
    };
    try {
        const response = await axios.delete<{ message: string }>(url, config);
        return response.data; // Should contain success message
    } catch (error) {
        console.error(`API Error removing member ${memberUserIdToRemove} from league ${leagueId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to remove member';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Requests the backend to regenerate the invite code for a league (League Admin only).
 */
export async function regenerateInviteCodeAdmin(leagueId: number, token: string): Promise<RegenerateCodeResponse> {
    const url = `${API_BASE_URL}/leagues/${leagueId}/invite-code`; // PATCH endpoint
    const config = { headers: { Authorization: `Bearer ${token}` } };
    try {
        // PATCH request, often doesn't need a body for this action
        const response = await axios.patch<RegenerateCodeResponse>(url, {}, config);
        return response.data; // Expect { message, inviteCode }
    } catch (error) {
        console.error(`API Error regenerating invite code for league ${leagueId}:`, error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to regenerate invite code';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

// --- NEW League Invite API Functions ---

/** Invite friends to a league */
export async function inviteFriendsToLeague(leagueId: number, userIds: number[], token: string): Promise<InviteFriendsResponse> {
    const url = `${API_BASE_URL}/leagues/${leagueId}/invites`;
    const payload: InviteFriendsPayload = { userIds };
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling inviteFriendsToLeague: POST ${url}`, 'color: green;', payload);
    try {
        const response = await axios.post<InviteFriendsResponse>(url, payload, config);
        console.log(`%c[inviteFriendsToLeague] Success response:`, 'color: green;', response.data);
        return response.data;
    } catch (error) {
        console.error(`%c[inviteFriendsToLeague] Error inviting to league ${leagueId}:`, 'color: red;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message ? error.response.data.message : 'Failed to send league invitations';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/** Get pending league invitations for the current user */
export async function getPendingLeagueInvites(token: string): Promise<PendingLeagueInvite[]> {
    const url = `${API_BASE_URL}/leagues/invites/pending`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling getPendingLeagueInvites: GET ${url}`, 'color: blue;');
    try {
        const response = await axios.get<PendingLeagueInvite[]>(url, config);
        console.log(`%c[getPendingLeagueInvites] Success response (count: ${response.data?.length})`, 'color: blue;');
        return response.data || [];
    } catch (error) {
        console.error(`%c[getPendingLeagueInvites] Error fetching pending invites:`, 'color: red;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message ? error.response.data.message : 'Could not load pending league invitations';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/** Accept a specific pending league invitation */
export async function acceptLeagueInvite(membershipId: number, token: string): Promise<AcceptInviteResponse> {
    const url = `${API_BASE_URL}/leagues/invites/${membershipId}/accept`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling acceptLeagueInvite: PATCH ${url}`, 'color: darkgreen;');
    try {
        const response = await axios.patch<AcceptInviteResponse>(url, {}, config); // Empty body for PATCH
        console.log(`%c[acceptLeagueInvite] Success response:`, 'color: darkgreen;', response.data);
        return response.data;
    } catch (error) {
        console.error(`%c[acceptLeagueInvite] Error accepting invite ${membershipId}:`, 'color: red;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message ? error.response.data.message : 'Failed to accept league invitation';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/** Reject (delete) a specific pending league invitation */
export async function rejectLeagueInvite(membershipId: number, token: string): Promise<void> {
    const url = `${API_BASE_URL}/leagues/invites/${membershipId}/reject`;
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling rejectLeagueInvite: DELETE ${url}`, 'color: darkred;');
    try {
        const response = await axios.delete(url, config);
        if (response.status !== 204) {
             console.warn(`%c[rejectLeagueInvite] Expected status 204 but got ${response.status}`, 'color: orange;');
        }
        console.log(`%c[rejectLeagueInvite] Success (status ${response.status})`, 'color: darkred;');
    } catch (error) {
        console.error(`%c[rejectLeagueInvite] Error rejecting invite ${membershipId}:`, 'color: red;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message ? error.response.data.message : 'Failed to reject league invitation';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Allows the currently logged-in user to leave a league they are a member of.
 */
export async function leaveLeague(leagueId: number, token: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/leagues/${leagueId}/membership`; // DELETE endpoint
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling leaveLeague: DELETE ${url}`, 'color: orange;');

    try {
        // DELETE requests might return 200 with message or 204 No Content
        const response = await axios.delete<{ message: string }>(url, config);
        console.log(`%c[leaveLeague] Success response status: ${response.status}`, 'color: orange;');
        // Return backend message if present, otherwise a default success message
        return response.data || { message: 'Successfully left league.' };
    } catch (error) {
        console.error(`%c[leaveLeague] Error leaving league ${leagueId}:`, 'color: red;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to leave league';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Deletes a league (League Admin/Creator only).
 */
export async function deleteLeagueAdmin(leagueId: number, token: string): Promise<{ message: string }> {
    const url = `${API_BASE_URL}/leagues/${leagueId}`; // DELETE /api/leagues/:leagueId
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling deleteLeagueAdmin: DELETE ${url}`, 'color: red;');

    try {
        // DELETE requests might return 200 with message or 204 No Content
        const response = await axios.delete<{ message: string }>(url, config);
        console.log(`%c[deleteLeagueAdmin] Success response status: ${response.status}`, 'color: red;');
        return response.data || { message: 'League deleted successfully.' };
    } catch (error) {
        console.error(`%c[deleteLeagueAdmin] Error deleting league ${leagueId}:`, 'color: red; font-weight: bold;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to delete league';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

/**
 * Triggers the backend to fetch latest results for unfinished fixtures in a specific round.
 * (Admin only)
 * @param roundId The ID of the round to fetch results for.
 * @param token Admin user's authentication token.
 * @returns Promise resolving to an object with message and updatedCount.
 * @throws ApiError
 */
export async function fetchRoundResultsAdmin(roundId: number, token: string): Promise<FetchResultsResponse> {
    // POST /api/admin/rounds/:roundId/fetch-results (or /api/rounds/... if route is there)
    // <<< Double check the actual route path you added in rounds.js or admin.js >>>
    const url = `${API_BASE_URL}/rounds/${roundId}/fetch-results`; // Adjust if route is under /admin
    const config = { headers: { Authorization: `Bearer ${token}` } };
    console.log(`%c[api.ts] Calling fetchRoundResultsAdmin: POST ${url}`, 'color: blueviolet;');

    try {
        // POST request, typically no body needed for this trigger action
        const response = await axios.post<FetchResultsResponse>(url, {}, config); // Send empty object as body
        console.log(`%c[fetchRoundResultsAdmin] Success response status: ${response.status}`, 'color: blueviolet;');
        return response.data; // Expect { message, updatedCount }
    } catch (error) {
        console.error(`%c[fetchRoundResultsAdmin] Error fetching results for round ${roundId}:`, 'color: red; font-weight: bold;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to trigger result fetching';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        // Handle specific errors like 429 Rate Limit from backend if needed
        if (statusCode === 429) {
             throw new ApiError('External API rate limit hit. Please try again later.', statusCode);
        }
        throw new ApiError(message, statusCode);
    }
}
// --- End NEW League Invite API Functions ---

/**
 * Sends the email verification token to the backend.
 */
export async function verifyEmail(token: string): Promise<VerificationResponse> {
    // GET /api/auth/verify-email/:token
    const url = `${API_BASE_URL}/auth/verify-email/${token}`;
    console.log(`%c[api.ts] Calling verifyEmail: GET ${url}`, 'color: cyan;');

    try {
        // Use axios.get for a GET request
        const response = await axios.get<VerificationResponse>(url);
        console.log(`%c[verifyEmail] Success response status: ${response.status}`, 'color: cyan;');
        return response.data; // Expect { success, message }
    } catch (error) {
        console.error(`%c[verifyEmail] Error verifying token:`, 'color: red; font-weight: bold;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Email verification failed';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode); // Throw custom error
    }
}

// --- End League API Functions ---

interface ResendResponse { // Simple response type
    message: string;
}

/**
 * Requests the backend to resend the verification email for the given email address.
 */
export async function resendVerificationEmail(email: string): Promise<ResendResponse> {
    const url = `${API_BASE_URL}/auth/resend-verification`;
    console.log(`%c[api.ts] Calling resendVerificationEmail for: ${email}`, 'color: magenta;');

    try {
        // POST request with email in the body
        const response = await axios.post<ResendResponse>(url, { email }); // Send email in body
        console.log(`%c[resendVerificationEmail] Success response status: ${response.status}`, 'color: magenta;');
        return response.data; // Expect { message: "..." }
    } catch (error) {
        console.error(`%c[resendVerificationEmail] Error resending for ${email}:`, 'color: red; font-weight: bold;', error);
        const message = axios.isAxiosError(error) && error.response?.data?.message
            ? error.response.data.message
            : 'Failed to resend verification email';
        const statusCode = axios.isAxiosError(error) ? (error.response?.status ?? 500) : 500;
        throw new ApiError(message, statusCode);
    }
}

// Optional: Add function to get sent pending requests if needed
// export async function getSentRequests(token: string): Promise<SentFriendRequest[]> { ... }

// Optional: Add function to search users if needed
// export async function searchUsers(query: string, token: string): Promise<FriendUser[]> { ... }


// --- End Friend API Functions ---


// ============================
// ==========================================================

// --- NOTE on Case Mapping ---
// Consistent approach: Frontend uses camelCase internally. API functions map
// snake_case responses from backend to camelCase using helpers. Payloads
// are sent as camelCase, assuming backend endpoints handle/expect this or map it internally.
// Specific endpoints confirmed/assumed to return camelCase (like /login, /rounds/active, /standings, /admin/*)
// skip explicit mapping but rely on backend contract.