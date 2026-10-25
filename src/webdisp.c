/* SPDX-License-Identifier: GPL-2.0-or-later
 * Included by sim.c, following the existing display convention.
 * Recording is synchronous and contains no browser or drawing calls.
 */
#include "webapi.h"
static void display_clear(void)
{
  int i, j;
  web_event(WEB_RESET, 0, 0, round_num);
  for (i = 0; i < warriors; ++i) {
    for (j = 0; j < warrior[i].instLen; ++j)
      web_event(WEB_LOAD, (warrior[i].position + j) % coreSize, i, 0);
    web_event(WEB_TASKS, 0, i, warrior[i].tasks);
  }
}
#define display_init() ((void)0)
#define display_close() ((void)0)
#define display_cycle() ((void)0)
#define display_read(a) web_event(WEB_READ, (a), W-warrior, 0)
#define display_write(a) web_event(WEB_WRITE, (a), W-warrior, 0)
#define display_exec(a) web_event(WEB_EXEC, (a), W-warrior, 0)
#define display_dec(a) web_event(WEB_DEC, (a), W-warrior, 0)
#define display_inc(a) web_event(WEB_INC, (a), W-warrior, 0)
#define display_spl(w,t) web_event(WEB_TASKS, 0, (w), (t))
#define display_dat(a,w,t) web_event(WEB_TASKS, (a), (w), (t)-1)
#define display_die(w) web_event(WEB_DEATH, progCnt, (w), 0)
#define display_push(v) ((void)0)
