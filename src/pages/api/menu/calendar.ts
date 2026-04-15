import type { APIRoute } from 'astro';

interface MenuDia {
  dia: string;
  comida?: { slug: string; title: string; tiempo: string; };
  cena?: { slug: string; title: string; tiempo: string; };
}

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function createUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}@recetas-de-casa`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { menu, siteUrl = 'https://recetas-de-casa.vercel.app' } = await request.json() as {
      menu: MenuDia[];
      siteUrl?: string;
    };

    if (!menu || !Array.isArray(menu)) {
      return new Response(JSON.stringify({ error: 'Menu no válido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const monday = getNextMonday();
    const events: string[] = [];

    menu.forEach((dia, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);

      if (dia.comida) {
        const start = new Date(date);
        start.setHours(13, 0, 0, 0);
        const end = new Date(date);
        end.setHours(14, 30, 0, 0);

        events.push(
`BEGIN:VEVENT
UID:${createUID()}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:🍽️ Comida: ${dia.comida.title}
DESCRIPTION:Receta: ${siteUrl}/recetas/${dia.comida.slug}/\\nTiempo: ${dia.comida.tiempo || 'No especificado'}
URL:${siteUrl}/recetas/${dia.comida.slug}/
STATUS:CONFIRMED
END:VEVENT`
        );
      }

      if (dia.cena) {
        const start = new Date(date);
        start.setHours(20, 30, 0, 0);
        const end = new Date(date);
        end.setHours(22, 0, 0, 0);

        events.push(
`BEGIN:VEVENT
UID:${createUID()}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:🌙 Cena: ${dia.cena.title}
DESCRIPTION:Receta: ${siteUrl}/recetas/${dia.cena.slug}/\\nTiempo: ${dia.cena.tiempo || 'No especificado'}
URL:${siteUrl}/recetas/${dia.cena.slug}/
STATUS:CONFIRMED
END:VEVENT`
        );
      }
    });

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Recetas de Casa//Menu Semanal//ES
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Menú Semanal - Recetas de Casa
X-WR-TIMEZONE:Europe/Madrid
${events.join('\n')}
END:VCALENDAR`;

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="menu-semanal.ics"'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Error generando calendario'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
