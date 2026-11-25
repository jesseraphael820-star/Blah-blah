import sys
from PIL import Image
fs=sys.argv[2:]; out=sys.argv[1]
rows=(len(fs)+1)//2
sh=Image.new('RGB',(1920,540*rows))
for i,f in enumerate(fs):
  sh.paste(Image.open(f).resize((960,540)),((i%2)*960,(i//2)*540))
sh.save(out)
