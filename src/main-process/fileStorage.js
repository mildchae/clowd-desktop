const getSize = require('get-folder-size')
const fs = require('fs')

const dir = 'C:\\Users\\chea1\\AppData\\Local\\atom'

function getFolderSize() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    getSize(dir, (err, size) => {
      if (err) {
        reject(err)
      }
      console.log(size + ' bytes')
      console.log((size / 1024 / 1024).toFixed(2) + ' MB')
      resolve(size / 1024 / 1024 / 1024) //return GB
    })
  })
}

module.exports = { getFolderSize }
