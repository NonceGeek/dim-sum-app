import * as React from 'react';

import {
  Switch as SwitchPrimitive,
  SwitchThumb as SwitchThumbPrimitive,
  SwitchIcon as SwitchIconPrimitive,
  type SwitchProps as SwitchPrimitiveProps,
} from '@/components/animate-ui/primitives/radix/switch';
import { cn } from '@/lib/utils';

const sizeConfig = {
  sm: {
    track: 'h-5 w-8 px-px',
    thumb: 'size-4',
    icon: '[&_svg]:size-[9px]',
    iconOffset: 'left-0.5',
    iconOffsetEnd: 'right-0.5',
    thumbIcon: '[&_svg]:size-[9px]',
    pressedWidth: 19,
  },
  md: {
    track: 'h-6 w-11 px-0.5',
    thumb: 'size-5',
    icon: '[&_svg]:size-3',
    iconOffset: 'left-1',
    iconOffsetEnd: 'right-1',
    thumbIcon: '[&_svg]:size-2.5',
    pressedWidth: 20,
  },
} as const;

type SwitchProps = SwitchPrimitiveProps & {
  size?: keyof typeof sizeConfig;
  pressedWidth?: number;
  startIcon?: React.ReactElement;
  endIcon?: React.ReactElement;
  thumbIcon?: React.ReactElement;
};

function Switch({
  className,
  size = 'sm',
  pressedWidth,
  startIcon,
  endIcon,
  thumbIcon,
  ...props
}: SwitchProps) {
  const s = sizeConfig[size];

  return (
    <SwitchPrimitive
      className={cn(
        'relative peer focus-visible:border-ring focus-visible:ring-ring/50 flex shrink-0 items-center justify-start rounded-full border border-transparent shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80 data-[state=checked]:justify-end',
        s.track,
        className,
      )}
      {...props}
    >
      <SwitchThumbPrimitive
        className={cn(
          'relative z-10 bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block rounded-full ring-0',
          s.thumb,
        )}
        pressedAnimation={{ width: pressedWidth ?? s.pressedWidth }}
      >
        {thumbIcon && (
          <SwitchIconPrimitive
            position="thumb"
            className={cn(
              'absolute left-1/2 top-1/2 -translate-1/2 dark:text-neutral-500 text-neutral-400',
              s.thumbIcon,
            )}
          >
            {thumbIcon}
          </SwitchIconPrimitive>
        )}
      </SwitchThumbPrimitive>

      {startIcon && (
        <SwitchIconPrimitive
          position="left"
          className={cn(
            'absolute top-1/2 -translate-y-1/2 dark:text-neutral-500 text-neutral-400',
            s.icon,
            s.iconOffset,
          )}
        >
          {startIcon}
        </SwitchIconPrimitive>
      )}
      {endIcon && (
        <SwitchIconPrimitive
          position="right"
          className={cn(
            'absolute top-1/2 -translate-y-1/2 dark:text-neutral-400 text-neutral-500',
            s.icon,
            s.iconOffsetEnd,
          )}
        >
          {endIcon}
        </SwitchIconPrimitive>
      )}
    </SwitchPrimitive>
  );
}

export { Switch, type SwitchProps };
