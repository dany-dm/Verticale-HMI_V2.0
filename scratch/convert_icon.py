# scratch/convert_icon.py
from PIL import Image
import os

def convert():
    png_path = r"C:\Users\User\.gemini\antigravity\brain\0b3d7fac-c31e-4775-844b-342f65cda309\hmi_icon_1781626715834.png"
    ico_path = r"c:\Users\User\Documents\antigravity\Verticale-HMI_V2.0\hmi_icon.ico"
    favicon_path = r"c:\Users\User\Documents\antigravity\Verticale-HMI_V2.0\web\favicon.ico"
    
    print(f"Opening PNG: {png_path}")
    if not os.path.exists(png_path):
        print("Error: PNG file not found!")
        return
        
    img = Image.open(png_path)
    
    # Dimensioni standard per un file .ico Windows
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    print(f"Saving multi-resolution ICO to: {ico_path}")
    img.save(ico_path, format="ICO", sizes=sizes)
    
    print(f"Saving favicon to: {favicon_path}")
    img.save(favicon_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    
    print("Conversion completed successfully!")

if __name__ == "__main__":
    convert()
