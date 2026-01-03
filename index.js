/**
 * ===============================
 *  WA BOT - DARURRAHMAH
 *  CLEAN FINAL VERSION
 * ===============================
 */

import 'dotenv/config'

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'

import pino from 'pino'
import fs from 'fs'
import path from 'path'
import fetch from 'node-fetch'
import express from 'express'
import QRCode from 'qrcode'
const app = express()
const PORT = process.env.PORT || 3000

let latestQR = null

app.get('/', (req, res) => {
  res.send('🤖 WA Bot Darurrahmah is running')
})

app.get('/qr', async (req, res) => {
  if (!latestQR) {
    return res.send('❌ QR belum tersedia atau sudah login')
  }

  const qrImage = await QRCode.toDataURL(latestQR)
  res.send(`
    <h2>Scan QR WhatsApp</h2>
    <img src="${qrImage}" />
  `)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Web running on port ${PORT}`)
})

/* ===============================
      KONFIGURASI
================================ */
const ADMIN_NUMBER = '6289517897482@s.whatsapp.net'
const delay = ms => new Promise(res => setTimeout(res, ms))

/* ===============================
      GOOGLE SHEET LOG
================================ */
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

/* ===============================
      START BOT
================================ */
async function startBot() {
  console.log('🤖 Bot starting...')

  const { state, saveCreds } =
    await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false

  })

  sock.ev.on('creds.update', saveCreds)

  /* ===============================
        CONNECTION STATUS
  ================================ */
  sock.ev.on('connection.update', (update) => {
  const { connection, lastDisconnect, qr } = update

  if (qr) {
    latestQR = qr
    console.log('📲 QR updated — buka /qr')
  }


    if (connection === 'open') {
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

  /* ===============================
        SEND MENU
  ================================ */
  async function sendMenu(jid) {
    const menuText = `📚 *Pondok Pesantren Darurrahmah Bogor*

Silakan ketik angka atau kata berikut:

1️⃣ Pendaftaran Santri Baru  
2️⃣ Biaya Pendidikan  
3️⃣ Kegiatan Harian Santri  
4️⃣ Fasilitas Pesantren  
5️⃣ Alamat & Lokasi  
6️⃣ Hubungi Admin  

✍️ Contoh:
- ketik *1*
- ketik *biaya*
- ketik *menu*`

    await sock.sendMessage(jid, { text: menuText })
  }

  /* ===============================
        MESSAGE HANDLER
  ================================ */
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

    /* ===============================
          SWITCH MENU
    ================================ */
    switch (true) {
      // MENU
      case ['menu', 'halo', 'hai', 'hi', 'assalamualaikum'].includes(text):
        await sendMenu(from)
        break

      // PENDAFTARAN
      case text === '1' || text.includes('pendaftaran'):
        await sock.sendMessage(from, {
          text: `📝 *Pendaftaran Santri Baru*

Silakan daftar melalui link berikut:
👉 https://tally.so/r/wLRgaj

Jika perlu bantuan, balas *admin*.`
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

Detail lengkap:
👉 https://daarurrahmah.com/info-biaya-pendaftaran-2026-pondok-pesantren-darurrahmah-bogor.html

Balas *admin* untuk konsultasi.`
        })
        break
      }

      // KEGIATAN
      case text === '3' || text.includes('kegiatan'):
        await sock.sendMessage(from, {
          text: `📖 *Kegiatan Harian Santri*

Lihat di:
👉 https://daarrurrahmah.com/kegiatan-harian-santri-pondok-pesantren-darurrahmah-bogor.html`
        })
        break

      // FASILITAS
      case text === '4' || text.includes('fasilitas'):
        await sock.sendMessage(from, {
          text: `🏫 *Fasilitas Pesantren*
👉 https://daarurrahmah.com/pondok-pesantren-darurrahmah-gunungputri-bogor-fasilitas-ber-ac-terjangkau.html      
✔ Asrama
✔ Masjid
✔ Ruang belajar
✔ Lingkungan islami`
        })
        break

      // LOKASI
      case text === '5' || text.includes('alamat') || text.includes('lokasi'):
        await sock.sendMessage(from, {
          text: `📍 *Alamat Pesantren*

Pondok Pesantren Darurrahmah  
Jl.KH.Tb Asep Basri Kp. Sanding Ds. Bojongnangka Kec. Gunungputri Kab. Bogor, Jawa Barat

📌 https://maps.app.goo.gl/jgCyKwnpkSBuRQGu7        `
        })
        break

      // HANDOVER ADMIN
      case text === '6' || text.includes('admin'):
        await sock.sendMessage(from, {
          text: `📞 *Admin Pesantren*

Admin akan segera menghubungi Anda.`
        })

        await sock.sendMessage(ADMIN_NUMBER, {
          text: `🔔 *HANDOVER ADMIN*

Nama: ${pushName}
Nomor: ${from.replace('@s.whatsapp.net', '')}
Pesan: ${text}`
        })
        break

      // DEFAULT
      default:
        await sock.sendMessage(from, {
          text: `❓ Pesan tidak dikenali.

Ketik *menu* untuk melihat pilihan.`
        })
    }

    /* ===============================
          LOG KE SHEET
    ================================ */
    await logToSheet({
      name: pushName,
      number: from.replace('@s.whatsapp.net', ''),
      message: text,
      time: new Date().toISOString()
    })
  })
}

startBot()
