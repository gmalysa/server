var timeout = require('./timeout.js')

function createUser(steam_user, mmr, steamId, profile) {
  var id = steamId.from64to32(profile.id)
  var name = profile.displayName
  var avatar = getAvatar(profile)
  return steam_user.getSteamUser(id.toString()).then(user => {
    return user
  }).catch(() => {
    return null
  }).then(existingUser => {
    var currentSolo = existingUser ? existingUser.solo_mmr : 0
    var currentParty = existingUser ? existingUser.party_mmr : 0
    var user = {
      steam_id: id.toString(),
      name: name,
      avatar: avatar,
      solo_mmr: currentSolo,
      party_mmr: currentParty
    }
    return mmr.getMMR(id).then(result => {
      user.solo_mmr = result && result.solo ? result.solo : user.solo_mmr
      user.party_mmr = result && result.party ? result.party : user.party_mmr
      return user
    }).catch(err => {
      console.error(err)
      return user
    })
  }).then(user => {
    return steam_user.saveSteamUser(user).then(() => {
      return user
    })
  })
}

var updated = false
function fetchMissingMMRs(steam_user, mmr, season_id, force) {
  if (!updated || force) {
    return steam_user.getSteamUsersMissingMMR(season_id).then(users => {
      updated = true
      return Promise.all(users.map((user) => {
        return updateUserMMR(steam_user, mmr, user).then(user => {
          console.log(`User ${user.steam_id} ${user.name} updated`)
        }).catch(err => {
          console.error(err)
        })
      })).catch(() => {
        // Doesn't matter if we have an error
        return null
      }).then(() => {
        return timeout(60 * 60 * 1000).then(() => {
          updated = false
        })
      })
    })
  } else {
    return Promise.resolve({ message: 'Sleeping' })
  }
}

function updateUserMMR(steam_user, mmr, user) {
  return mmr.getMMR(user.steam_id).then(result => {
    user.solo_mmr = result && result.soll ? result.solo : user.solo_mmr
    user.party_mmr = result && result.party ? result.party : user.party_mmr
    return steam_user.saveSteamUser(user).then(() => {
      return user
    })
  })
}

function inflateUser(admin, profile, steamId, user) {
  var id = steamId.from64to32(user.profile.id).toString()

  return admin.isAdmin(id).then(isAdmin => {
    return profile.getProfile(id).then(profile => {
      user.isAdmin = isAdmin
      user.avatar = getAvatar(user.profile)
      user.displayName = profile.name
      user.steamId = id
      return user
    })
  })
}

function getAvatar(profile) {
  return profile.photos[profile.photos.length - 1].value
}

module.exports = (admin, steam_user, profile, mmr, steamId) => {
  return {
    createUser: createUser.bind(null, steam_user, mmr, steamId),
    fetchMissingMMRs: fetchMissingMMRs.bind(null, steam_user, mmr),
    updateUserMMR: updateUserMMR.bind(null, steam_user, mmr),
    inflateUser: inflateUser.bind(null, admin, profile, steamId),
    getAvatar: getAvatar
  }
}
