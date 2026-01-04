/**
 * ==========================================
 *  WA BOT - DARURRAHMAH (FINAL HUMAN-LIKE VERSION)
 *  Baileys + Railway + QR via Web
 * ==========================================
 */

import 'dotenv/config'

// ===== CORE =====
import express from 'express'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'
import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

// ==========================================
// KONFIGURASI
// ==========================================
const ADMIN_NUMBER = '6289517897482@s.whatsapp.net'
const delay = ms => new Promise(res => setTimeout(res, ms))

// ==========================================
// EXPRESS SERVER (UNTUK QR)
// ==========================================
const app = express()
const PORT = process.env.PORT || 3000

let latestQR = null

app.get('/', (req, res) => {
  res.send('🤖 WA Bot Darurrahmah is running')
})

app.get('/qr', async (req, res) => {
  if (!latestQR) {
    return res.send('✅ Sudah login atau QR belum tersedia')
  }

  const qrImage = await QRCode.toDataURL(latestQR)
  res.send(`
    <h2>Scan QR WhatsApp</h2>
    <p>Buka WhatsApp → Perangkat tertaut → Pindai QR di bawah ini</p>
    <img src="${qrImage}" />
  `)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web running on port ${PORT}`)
})

// ==========================================
// GOOGLE SHEET LOG
// ==========================================
async function logToSheet(data) {
  if (!process.env.SHEET_URL) return

  try {
    await fetch(process.env.SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
  } catch (err) {
    console.error('❌ Sheet Error:', err.message)
  }
}

// ==========================================
// START BOT
// ==========================================
async function startBot() {
  console.log('🤖 Bot starting...')

  const { state, saveCreds } =
    await useMultiFileAuthState('/data/auth')

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  })

  sock.ev.on('creds.update', saveCreds)

  // ==========================================
  // CONNECTION STATUS + QR
  // ==========================================
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    // ✅ QR HANDLER
    if (qr) {
      latestQR = qr
      console.log('📲 QR updated — buka /qr')
    }

    if (connection === 'open') {
      latestQR = null
      console.log('✅ WhatsApp Connected')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log('🔁 Reconnecting...')
        startBot()
      } else {
        console.log('❌ Logged out.')
      }
    }
  })

  // ==========================================
  // SEND MENU HUMAN-LIKE
  // ==========================================
  async function sendMenu(jid) {
    const menuText = `📚 *Pondok Pesantren Darurrahmah Bogor*

Halo! Selamat datang di WhatsApp resmi Pondok Pesantren Darurrahmah. 😊  
Silakan pilih salah satu menu di bawah ini untuk info lengkap:

1️⃣ Pendaftaran Santri Baru  
2️⃣ Biaya Pendidikan  
3️⃣ Kegiatan Harian Santri  
4️⃣ Fasilitas Pesantren  
5️⃣ Alamat & Lokasi  
6️⃣ Hubungi Admin  

✍️ Contoh penggunaan:
- ketik *1* untuk daftar
- ketik *biaya* untuk info biaya
- ketik *menu* untuk lihat daftar menu`
    await sock.sendMessage(jid, { text: menuText })
  }

  // ==========================================
  // MESSAGE HANDLER
  // ==========================================
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    if (from.endsWith('@g.us')) return

    const pushName = msg.pushName || '-'

    let text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text

    if (!text) return
    text = text.toLowerCase().trim()

    console.log('📩 TEXT:', text)

    switch (true) {
      // MENU
      case ['menu', 'halo', 'hai', 'hi', 'assalamualaikum'].includes(text):
        await sendMenu(from)
        break

      // PENDAFTARAN
      case text === '1' || text.includes('pendaftaran'):
        await sock.sendMessage(from, {
          text: `📝 *Pendaftaran Santri Baru*

Hai ${pushName}! Jika kamu ingin mendaftar menjadi santri di Pondok Pesantren Darurrahmah, silakan klik link di bawah ini. Semua langkah pendaftaran dijelaskan di sana dengan mudah.  

👉 [Daftar Santri Baru](https://tally.so/r/wLRgaj)

Jika butuh bantuan, balas *admin* ya.` 
        })
        break

      // BIAYA + BROSUR
      case text === '2' || text.includes('biaya'): {
        const filePath = path.join(
          process.cwd(),
          'assets',
          'brosur-biaya.pdf'
        )

        await sock.sendMessage(from, {
          document: fs.readFileSync(filePath),
          mimetype: 'application/pdf',
          fileName: 'Brosur Biaya Pesantren Darurrahmah.pdf'
        })

        await delay(1000)

        await sock.sendMessage(from, {
          text: `💰 *Biaya Pendidikan*

Halo ${pushName}! Berikut informasi lengkap biaya pendidikan di pesantren kami. Kamu bisa melihat brosur di atas dan juga info online di link ini:

👉 [Lihat Detail Biaya](https://daarurrahmah.com/info-biaya-pendaftaran-2026-pondok-pesantren-darurrahmah-bogor.html)

Jika ada pertanyaan, admin siap membantu.` 
        })
        break
      }

      // KEGIATAN
      case text === '3' || text.includes('kegiatan'):
        await sock.sendMessage(from, {
          text: `📖 *Kegiatan Harian Santri*

Halo ${pushName}! Setiap harinya santri mengikuti jadwal kegiatan yang menyenangkan dan mendidik.  
Kamu bisa melihat detail kegiatan harian di link berikut:  

👉 [Lihat Kegiatan Harian](https://daarrurrahmah.com/kegiatan-harian-santri-pondok-pesantren-darurrahmah-bogor.html)` 
        })
        break

      // FASILITAS
      case text === '4' || text.includes('fasilitas'):
        await sock.sendMessage(from, {
          text: `🏫 *Fasilitas Pesantren*

Halo ${pushName}! Fasilitas yang nyaman akan membantu santri belajar dan beraktivitas dengan baik. Beberapa fasilitas kami antara lain:  
✔ Asrama nyaman  
✔ Masjid luas  
✔ Ruang belajar  
✔ Lingkungan islami

Info lengkap bisa dilihat di link:  
👉 [Lihat Fasilitas](https://daarurrahmah.com/pondok-pesantren-darurrahmah-gunungputri-bogor-fasilitas-ber-ac-terjangkau.html)` 
        })
        break

      // LOKASI
      case text === '5' || text.includes('alamat') || text.includes('lokasi'):
        await sock.sendMessage(from, {
          text: `📍 *Alamat Pesantren*

Halo ${pushName}! Pondok Pesantren Darurrahmah terletak di Gunungputri, Bogor. Lokasinya mudah diakses dan dekat fasilitas umum.  

Jl. KH. Tb Asep Basri, Gunungputri, Bogor  
📌 [Lihat di Maps](https://maps.app.goo.gl/jgCyKwnpkSBuRQGu7)` 
        })
        break

      // HANDOVER ADMIN
      case text === '6' || text.includes('admin'):
        await sock.sendMessage(from, {
          text: `📞 Admin akan segera menghubungi kamu. Mohon tunggu sebentar ya 😊` 
        })

        await sock.sendMessage(ADMIN_NUMBER, {
          text: `🔔 *HANDOVER ADMIN*
Nama: ${pushName}
Nomor: ${from.replace('@s.whatsapp.net', '')}` 
        })
        break

      // DEFAULT
      default:
        await sock.sendMessage(from, {
          text: `❓ Maaf ${pushName}, saya belum mengerti pesanmu.

Silakan ketik *menu* untuk melihat pilihan yang tersedia.` 
        })
    }

    await logToSheet({
      name: pushName,
      number: from.replace('@s.whatsapp.net', ''),
      message: text,
      time: new Date().toISOString()
    })
  })
}

startBot()
