/**
 * useNavigation — shared state for in-app directions.
 *
 * When a user taps "Get Directions" anywhere in the app,
 * the destination is lifted to App-level state and passed
 * to MapView, which flies to the location and shows a
 * distance/bearing overlay from the user's GPS position.
 */

export interface NavDestination {
  id: string;
  name: string;
  address: string;
  coords: [number, number]; // [lat, lng]
  phone?: string;
  type?: string;            // e.g. 'shelter' | 'hospital' | 'food' etc.
}
