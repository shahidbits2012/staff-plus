import React, {type ReactNode} from 'react';
import clsx from 'clsx';
import DefaultAdmonitionTypes from '@theme-original/Admonition/Types';
import AdmonitionLayout from '@theme/Admonition/Layout';
import type {Props} from '@theme/Admonition';

/**
 * `:::staff` — highlights Staff/Principal-level reasoning in problem pages:
 * trade-offs, second-order effects, and "what would make us revisit this".
 * Usage: `:::staff[Optional custom title]`
 */
function StaffIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2l2.9 6.26L22 9.27l-5.2 4.73L18.18 21 12 17.27 5.82 21 7.2 14l-5.2-4.73 7.1-1.01L12 2z"
      />
    </svg>
  );
}

function AdmonitionTypeStaff(props: Props): ReactNode {
  return (
    <AdmonitionLayout
      icon={<StaffIcon />}
      title="Staff+ Insight"
      {...props}
      className={clsx('alert', 'admonition-staff', props.className)}>
      {props.children}
    </AdmonitionLayout>
  );
}

const AdmonitionTypes = {
  ...DefaultAdmonitionTypes,
  staff: AdmonitionTypeStaff,
};

export default AdmonitionTypes;
