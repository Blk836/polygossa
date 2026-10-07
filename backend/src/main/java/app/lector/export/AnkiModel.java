package app.lector.export;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** The Anki note type (model) the export uses: its fields, card template and styling. */
final class AnkiModel {

    /** Field order is fixed: notes store their values in this order. New fields go at the end. */
    static final List<String> FIELDS =
            List.of("Word", "Definition", "Pronunciation", "PartOfSpeech", "Context", "Example", "Language", "Notes");

    private AnkiModel() {}

    static Map<String, Object> model(long modelId, long deckId, String name, long mod) {
        List<Map<String, Object>> flds = new ArrayList<>();
        for (int i = 0; i < FIELDS.size(); i++) {
            flds.add(Map.of("font", "Arial", "media", List.of(), "name", FIELDS.get(i), "ord", i, "rtl", false,
                    "size", 20, "sticky", false));
        }
        String front = "<div class=\"word\">{{Word}}</div>";
        String back = "{{FrontSide}}<hr id=\"answer\">"
                + "{{#Pronunciation}}<div class=\"pron\">{{Pronunciation}}</div>{{/Pronunciation}}"
                + "{{#PartOfSpeech}}<div class=\"pos\">{{PartOfSpeech}}</div>{{/PartOfSpeech}}"
                + "<div class=\"def\">{{Definition}}</div>"
                + "{{#Context}}<div class=\"ctx\">{{Context}}</div>{{/Context}}"
                + "{{#Example}}<div class=\"ex\">{{Example}}</div>{{/Example}}"
                + "{{#Notes}}<div class=\"note\">{{Notes}}</div>{{/Notes}}";
        Map<String, Object> tmpl = new LinkedHashMap<>();
        tmpl.put("afmt", back);
        tmpl.put("bafmt", "");
        tmpl.put("bqfmt", "");
        tmpl.put("did", null);
        tmpl.put("name", "Recognition");
        tmpl.put("ord", 0);
        tmpl.put("qfmt", front);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("css", ".card{font-family:Georgia,serif;font-size:20px;text-align:center;color:#1c1917;background:#fffdf8}"
                + ".word{font-size:34px;font-weight:600}.pron{color:#57534e}.pos{font-style:italic;color:#78716c}"
                + ".def{margin:12px 0}.ctx,.ex,.note{font-size:16px;color:#44403c;margin-top:8px}.note{font-style:italic}");
        m.put("did", deckId);
        m.put("flds", flds);
        m.put("id", modelId);
        m.put("latexPost", "\\end{document}");
        m.put("latexPre", "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage{amssymb,amsmath}\n"
                + "\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n");
        m.put("mod", mod);
        m.put("name", name);
        m.put("req", List.of(List.of(0, "any", List.of(0))));
        m.put("sortf", 0);
        m.put("tags", List.of());
        m.put("tmpls", List.of(tmpl));
        m.put("type", 0);
        m.put("usn", -1);
        m.put("vers", List.of());
        return m;
    }
}
