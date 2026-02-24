import PocketBase from 'pocketbase'

export const pb = new PocketBase('https://api.responda.systems')

// Enable auto cancellation for duplicate requests
pb.autoCancellation(false)

export default pb
