import React from 'react';
import { PIN_HEIGHT, PIN_WIDTH, SITE_HOST } from './constants';
import { categoryLabel, resolveRecipeImageUrl, truncatePinTitle } from './pinCopy';
import type { Receta } from '../types';

type PinTemplateProps = {
  receta: Pick<Receta, 'title' | 'imagen' | 'categoria' | 'categorias' | 'tiempo'>;
  siteUrl: string;
};

export function PinterestPinTemplate({ receta, siteUrl }: PinTemplateProps) {
  const imageUrl = resolveRecipeImageUrl(receta.imagen, siteUrl);
  const title = truncatePinTitle(receta.title);
  const categoria = categoryLabel(receta);
  const tiempo = receta.tiempo?.trim();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#faf8f4',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 40px 32px',
          minHeight: '280px',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            color: '#1a1a18',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
        {(categoria || tiempo) && (
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              fontSize: 22,
              color: '#6b6b66',
              gap: 12,
            }}
          >
            {categoria && <span>{categoria}</span>}
            {tiempo && <span>· {tiempo}</span>}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          margin: '0 40px',
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: '#eceae4',
          minHeight: 0,
        }}
      >
        <img
          src={imageUrl}
          alt=""
          width={920}
          height={920}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 40px 48px',
          fontSize: 28,
          fontWeight: 600,
          color: '#3d3d38',
          letterSpacing: '0.02em',
        }}
      >
        {SITE_HOST}
      </div>
    </div>
  );
}

export const pinImageOptions = {
  width: PIN_WIDTH,
  height: PIN_HEIGHT,
} as const;
