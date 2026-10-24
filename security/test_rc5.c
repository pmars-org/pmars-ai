/* Placement RNG for non-numeric -F seeds (RC5 in counter mode, src/pos.c).
 * Build: gcc -I src security/test_rc5.c src/global.c -o test_rc5
 * Usage: test_rc5 KEY  -> prints distinct second-warrior offsets in 1000
 * rounds of an 8000-cell core (separation 100) and the first eight offsets.
 * With no argument it runs the self-checks below. */
#include <stdio.h>
#include <string.h>
#include "../src/pos.c"

static int failures, checks;
static void check(int ok, const char *what)
{
  ++checks;
  if (!ok) { fprintf(stderr, "FAIL %s\n", what); ++failures; }
}

int main(int argc, char **argv)
{
  U32_T schedule[2*(12+1)];
  static unsigned char seen[7801];
  int i, distinct = 0;
  useExtRNG = 1;
  SWITCH_F = argc > 1 ? argv[1] : "pair:hill-1:m4klzy:ia0epo";
  if (argc > 1) {
    for (i = 0; i < 1000; i++) {
      int offset = 100 + rng(0) % 7801;
      if (i < 8) printf("%d ", offset);
      if (!seen[offset - 100]++) ++distinct;
    }
    printf("\ndistinct %d\n", distinct);
    return 0;
  }
  /* Rotations, including the y=0 and y=31 edges. */
  check(ROL(0x80000001u, 1) == 0x00000003u, "ROL by 1");
  check(ROR(0x00000003u, 1) == 0x80000001u, "ROR by 1");
  check(ROL(0x12345678u, 0) == 0x12345678u && ROR(0x12345678u, 32) == 0x12345678u, "rotate by 0/32");
  check(ROL(0x12345678u, 31) == ROR(0x12345678u, 1), "ROL 31 equals ROR 1");
  check(ROL(0x12345678u, 8) == 0x34567812u, "ROL by 8");
  /* Encryption is invertible for many counters, so the counter mode output is a permutation. */
  init_rc5(schedule);
  for (i = 0; i < 1000; i++) {
    U32_T a = 0, b = (U32_T)i * 2654435761u;
    rc5_crypt(&a, &b, schedule, 12);
    rc5_decrypt(&a, &b, schedule, 12);
    if (a != 0 || b != (U32_T)i * 2654435761u) break;
  }
  check(i == 1000, "rc5_decrypt inverts rc5_crypt");
  /* A uniform generator gives about 7801*(1-e^(-1000/7801)) = 939 distinct offsets.
   * The broken rotations gave 181 for this key. */
  for (i = 0; i < 1000; i++) {
    int offset = rng(0) % 7801;
    if (!seen[offset]++) ++distinct;
  }
  check(distinct > 900, "1000 rounds spread over the core");
  printf("%s: %d RC5 placement checks (%d distinct offsets)\n", failures ? "FAIL" : "PASS", checks, distinct);
  return failures != 0;
}
