package com.arrow.dws.adapter.render;

import com.arrow.dws.domain.model.Artifact;
import com.arrow.dws.domain.model.ArtifactKind;
import com.arrow.dws.domain.model.BlockDiagram;
import com.arrow.dws.domain.model.Design;
import com.arrow.dws.domain.port.ArtifactRenderer;

import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;

/**
 * Draws a block diagram as a PNG.
 *
 * <p>The workspace holds a reference to each diagram, not its canvas — that
 * lives in the block diagram service. So this renders what the workspace
 * actually knows: the diagram's identity, revision and status, laid out as a
 * recognisable block sketch. It is a placeholder with an honest shape, and
 * replacing it later means calling the diagram service's own export and
 * returning those bytes — the interface does not change.
 */
@Component
public class DiagramPngRenderer implements ArtifactRenderer {

    private static final int WIDTH = 1200;
    private static final int HEIGHT = 675;      // 16:9, so it fits a preview tile

    // Arrow palette.
    private static final Color INK = new Color(0x1A, 0x1A, 0x1A);
    private static final Color MUTED = new Color(0x6B, 0x72, 0x80);
    private static final Color SKY = new Color(0x00, 0x84, 0xD5);
    private static final Color GREEN = new Color(0x47, 0xD7, 0xAC);
    private static final Color COPPER = new Color(0xFF, 0xC8, 0x45);
    private static final Color RULE = new Color(0xE2, 0xE5, 0xE9);

    @Override
    public ArtifactKind handles() {
        return ArtifactKind.BLOCK_DIAGRAM;
    }

    @Override
    public byte[] render(Design design, Artifact artifact) {
        BlockDiagram diagram = design.diagrams().stream()
                .filter(d -> d.id().equals(artifact.sourceId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Artifact " + artifact.id() + " refers to unknown diagram " + artifact.sourceId()));

        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setColor(Color.WHITE);
            g.fillRect(0, 0, WIDTH, HEIGHT);

            drawHeader(g, design, diagram);
            drawBlocks(g, design);
            drawFooter(g, design, diagram);
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            ImageIO.write(image, "png", out);
        } catch (IOException ex) {
            // Writing to a byte array cannot fail on I/O; if it somehow does,
            // it is not something a caller can recover from.
            throw new UncheckedIOException("Could not encode " + artifact.fileName(), ex);
        }
        return out.toByteArray();
    }

    private void drawHeader(Graphics2D g, Design design, BlockDiagram diagram) {
        g.setColor(INK);
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 34));
        g.drawString(diagram.name(), 48, 68);

        g.setColor(MUTED);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 17));
        g.drawString(design.name() + "  ·  " + design.customer(), 48, 98);

        g.setColor(RULE);
        g.setStroke(new BasicStroke(1.5f));
        g.drawLine(48, 118, WIDTH - 48, 118);

        // Status pill, coloured from the domain rather than decided here.
        String status = diagram.status().label();
        Color tone = switch (diagram.status().tone()) {
            case POSITIVE -> GREEN;
            case CRITICAL, WARNING -> new Color(0xFF, 0x86, 0x74);
            case INFO -> SKY;
            default -> MUTED;
        };
        g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 15));
        int pillWidth = g.getFontMetrics().stringWidth(status) + 28;
        g.setColor(tone);
        g.fill(new RoundRectangle2D.Float(WIDTH - 48 - pillWidth, 44, pillWidth, 30, 15, 15));
        g.setColor(Color.WHITE);
        g.drawString(status, WIDTH - 48 - pillWidth + 14, 65);
    }

    /** A block per major part, wired left to right — the shape of a real diagram. */
    private void drawBlocks(Graphics2D g, Design design) {
        List<String> blocks = design.parts().stream().map(p -> p.function()).limit(4).toList();
        if (blocks.isEmpty()) {
            return;
        }

        int count = blocks.size();
        int boxWidth = 210;
        int boxHeight = 110;
        int gap = (WIDTH - 96 - count * boxWidth) / Math.max(1, count - 1 + 1);
        int y = 260;
        int x = 48 + gap / 2;

        for (int i = 0; i < count; i++) {
            g.setColor(new Color(0xF6, 0xF7, 0xF8));
            g.fill(new RoundRectangle2D.Float(x, y, boxWidth, boxHeight, 14, 14));
            g.setColor(i % 2 == 0 ? SKY : GREEN);
            g.setStroke(new BasicStroke(2.5f));
            g.draw(new RoundRectangle2D.Float(x, y, boxWidth, boxHeight, 14, 14));

            g.setColor(INK);
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, 16));
            drawWrapped(g, blocks.get(i), x + 16, y + 38, boxWidth - 32);

            g.setColor(MUTED);
            g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 13));
            g.drawString(design.parts().get(i).manufacturerPartNumber(), x + 16, y + boxHeight - 18);

            if (i < count - 1) {
                int fromX = x + boxWidth;
                int toX = x + boxWidth + gap;
                int midY = y + boxHeight / 2;
                g.setColor(MUTED);
                g.setStroke(new BasicStroke(2f));
                g.drawLine(fromX, midY, toX - 10, midY);
                g.fillPolygon(new int[]{toX, toX - 12, toX - 12},
                              new int[]{midY, midY - 6, midY + 6}, 3);
            }
            x += boxWidth + gap;
        }
    }

    private void drawFooter(Graphics2D g, Design design, BlockDiagram diagram) {
        g.setColor(RULE);
        g.setStroke(new BasicStroke(1.5f));
        g.drawLine(48, HEIGHT - 92, WIDTH - 48, HEIGHT - 92);

        g.setColor(MUTED);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 15));
        g.drawString(diagram.revision() + "  ·  updated " + diagram.updatedLabel()
                + "  ·  " + diagram.summary(), 48, HEIGHT - 60);

        g.setColor(COPPER);
        g.fillRect(48, HEIGHT - 40, 44, 5);
        g.setColor(MUTED);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 13));
        g.drawString(design.id() + "  ·  " + design.owner(), 108, HEIGHT - 34);
    }

    /** Two lines maximum, so a long function name cannot run out of its box. */
    private void drawWrapped(Graphics2D g, String text, int x, int y, int maxWidth) {
        StringBuilder line = new StringBuilder();
        int drawnLines = 0;
        for (String word : text.split(" ")) {
            String candidate = line.isEmpty() ? word : line + " " + word;
            if (g.getFontMetrics().stringWidth(candidate) > maxWidth && !line.isEmpty()) {
                g.drawString(line.toString(), x, y + drawnLines * 20);
                line = new StringBuilder(word);
                if (++drawnLines == 2) return;
            } else {
                line = new StringBuilder(candidate);
            }
        }
        g.drawString(line.toString(), x, y + drawnLines * 20);
    }
}
