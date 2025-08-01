import type { SVGProps } from 'react';

export function CheckInterventoriaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21.16,6.38a1,1,0,0,0-.24-.48l-3.34-3.34a1,1,0,0,0-1.42,0l-12,12a1,1,0,0,0,0,1.42L7.5,19.8a1,1,0,0,0,.71.29,1,1,0,0,0,.71-.29l12-12a1,1,0,0,0,.24-1.13Z" />
      <path d="M4.22,12.32l5.46,5.46" />
      <path d="M9.68,6.86,4.22,1.4" />
      <path d="M12.8,20.58,11.38,22" />
      <path d="M11.38,2,12.8,3.42" />
      <path d="M3.42,11.38,2,12.8" />
      <path d="M22,11.38,20.58,12.8" />
    </svg>
  );
}
